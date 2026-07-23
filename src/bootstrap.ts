const requestedView = new URLSearchParams(location.search).get('view');

if (requestedView === 'player') {
  await import('./player/player.css');
  const room = new URLSearchParams(location.search).get('room');
  const { readNetcodeConfig } = await import('./netcode/NetcodeConfig');
  const netcode = readNetcodeConfig();
  if (room !== null && netcode.enabled) {
    const { installNetworkedPlayerApp } = await import('./netcode/NetworkPlayerBootstrap');
    await installNetworkedPlayerApp();
  } else if (room !== null) {
    document.body.classList.add('player-view-body', 'player-join-body');
    const app = document.querySelector<HTMLElement>('#app');
    if (app !== null) {
      app.innerHTML = '<main class="player-join-shell"><section class="player-join-card"><span class="player-preview-badge">HOSTING CONFIGURATION</span><h1>Campaign link is not configured</h1><p>This deployment is missing its Supabase public URL, publishable key, or the hosting-enabled setting. Ask the GM to finish the deployment setup and send the link again.</p></section></main>';
    }
  } else {
    const { installPlayerApp } = await import('./player/PlayerApp');
    installPlayerApp();
  }
} else {
  await import('./styles.css');
  await import('./ui/ms21.css');
  const { installMilestone21Shell } = await import('./ui/Milestone21Shell');
  installMilestone21Shell();
  await import('./main');
}
