const requestedView = new URLSearchParams(location.search).get('view');

if (requestedView === 'player') {
  await import('./player/player.css');
  const { preparePlayerRoot } = await import('./player/PlayerRoot');
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) throw new Error('Player View requires the #app root.');
  preparePlayerRoot(app, 'PAYAW Player Portal', 'player-view-body', 'player-join-body');
  const projectionToken = new URLSearchParams(location.search).get('projection');
  if (projectionToken !== null) {
    const { installPlayerApp } = await import('./player/PlayerApp');
    installPlayerApp();
  } else {
    const { readNetcodeConfig } = await import('./netcode/NetcodeConfig');
    const netcode = readNetcodeConfig();
    if (netcode.enabled) {
      const { installNetworkedPlayerApp } = await import('./netcode/NetworkPlayerBootstrap');
      await installNetworkedPlayerApp();
    } else {
      app.innerHTML = '<main class="player-join-shell"><section class="player-join-card"><span class="player-preview-badge">HOSTING CONFIGURATION</span><h1>Player Portal is not configured</h1><p>This deployment is missing its Supabase public URL, publishable key, or hosting-enabled setting. Ask the GM to finish the deployment setup.</p></section></main>';
    }
  }
} else {
  await import('./styles.css');
  await import('./ui/ms21.css');
  const { installMilestone21Shell } = await import('./ui/Milestone21Shell');
  installMilestone21Shell();
  await import('./main');
}
