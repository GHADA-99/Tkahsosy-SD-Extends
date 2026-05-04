// Tweaks panel
function TweaksPanel({ tweaks, setTweaks, visible }) {
  if (!visible) return null;
  const set = (patch) => {
    setTweaks(t => ({ ...t, ...patch }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  const accents = [
    { id: 'teal',   color: '#0D9488' },
    { id: 'blue',   color: '#3B82F6' },
    { id: 'violet', color: '#8B5CF6' },
  ];

  return (
    <div className="tweaks-panel">
      <h3>
        <I.Sliders size={14}/> Tweaks
        <span className="dim">live</span>
      </h3>

      <div className="tweak-row">
        <span className="lbl">Accent color</span>
        <div className="swatch-row">
          {accents.map(a => (
            <button key={a.id} className="swatch" aria-pressed={tweaks.accent === a.id}
                    style={{background: a.color}} onClick={() => set({accent: a.id})}/>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <span className="lbl">Density</span>
        <div style={{display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 2}}>
          {['comfortable','compact'].map(d => (
            <button key={d} onClick={() => set({density: d})}
                    style={{padding: '3px 8px', fontSize: 11, fontWeight: 500, borderRadius: 4,
                            background: tweaks.density === d ? 'var(--surface)' : 'transparent',
                            color: tweaks.density === d ? 'var(--ink)' : 'var(--muted)',
                            boxShadow: tweaks.density === d ? 'var(--shadow-xs)' : 'none'}}>
              {d[0].toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <span className="lbl">Show Arabic</span>
        <button className="switch" data-on={tweaks.showArabic} onClick={() => set({showArabic: !tweaks.showArabic})}/>
      </div>

      <div className="tweak-row">
        <span className="lbl">Live sync simulation</span>
        <button className="switch" data-on={tweaks.liveSync} onClick={() => set({liveSync: !tweaks.liveSync})}/>
      </div>

      <div className="tweak-row">
        <span className="lbl">Dark mode</span>
        <button className="switch" data-on={tweaks.dark} onClick={() => set({dark: !tweaks.dark})}/>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel });
