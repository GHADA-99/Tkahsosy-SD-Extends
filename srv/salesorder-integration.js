'use strict';

const cds = require('@sap/cds');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

// ─── S/4HANA org data ────────────────────────────────────────────────────────
const S4 = {
    SalesOrderType      : 'OR',
    SalesOrganization   : '5910',
    DistributionChannel : '10',
    OrganizationDivision: '00',
    SoldToParty         : '59100001',
    Material            : '235',
    Quantity            : 2,
    QuantityUnit        : 'EA'
};

// ─── Register handlers on the given service instance ─────────────────────────
function registerSalesOrderV2Handlers(srv) {

    const { SalesOrdersV2 } = srv.entities;

    // Fires on first POST (new record) — fire-and-forget so response is not blocked
    srv.after('CREATE', SalesOrdersV2, (data) => {
        _postToS4(data.salesOrderId, SalesOrdersV2)
            .catch(err => console.error('[S4] Unhandled error in after CREATE:', err.message));
        // intentionally no return / no await — response goes back to client immediately
    });

    // Fires on PATCH (update) — guard against re-posting already submitted orders
    srv.after('UPDATE', SalesOrdersV2, (data) => {
        SELECT.one.from(SalesOrdersV2).where({ salesOrderId: data.salesOrderId })
            .then(order => {
                // Skip if already successfully posted to S/4HANA
                if (order && order.status === 'submitted') {
                    console.log('[S4] Order already submitted, skipping re-post');
                    return;
                }
                return _postToS4(data.salesOrderId, SalesOrdersV2);
            })
            .catch(err => console.error('[S4] Unhandled error in after UPDATE:', err.message));
        // intentionally no return / no await
    });
}

// ─── Core posting logic (header only) ────────────────────────────────────────
async function _postToS4(orderId, SalesOrdersV2) {

    const payload = {
        SalesOrderType      : S4.SalesOrderType,
        SalesOrganization   : S4.SalesOrganization,
        DistributionChannel : S4.DistributionChannel,
        OrganizationDivision: S4.OrganizationDivision,
        SoldToParty         : S4.SoldToParty
    };

    console.log('[S4] Posting header to A_SalesOrder:', JSON.stringify(payload, null, 2));

    try {
        console.log('[S4] Sending POST to A_SalesOrder via Cloud SDK (CSRF handled automatically) ...');

        // executeHttpRequest resolves the destination, fetches CSRF token and sends the POST
        const response = await executeHttpRequest(
            { destinationName: 'Public_Cloud' },
            {
                method : 'POST',
                url    : '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder',
                data   : payload,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept'      : 'application/json'
                }
            },
            { fetchCsrfToken: true }
        );

        const erpId = response.data?.d?.SalesOrder;

        console.log('[S4] Success! ERP SalesOrder created:', erpId);

        await UPDATE(SalesOrdersV2)
            .set({ erpSalesOrderId: erpId, status: 'submitted' })
            .where({ salesOrderId: orderId });

    } catch (err) {
        const detail = err.response?.data ?? err.cause?.message ?? err.message;
        console.error(`[S4] POST failed for order ${orderId}:`, JSON.stringify(detail, null, 2));

        await UPDATE(SalesOrdersV2)
            .set({ status: 'error' })
            .where({ salesOrderId: orderId });
    }
}

module.exports = { registerSalesOrderV2Handlers };
