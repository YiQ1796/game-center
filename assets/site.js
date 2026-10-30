(() => {
  'use strict';
  const games = window.SANMAO_GAMES;
  const gameList = document.getElementById('game-list');
  const searchToggle = document.getElementById('search-toggle');
  const searchPanel = document.getElementById('search-panel');
  const searchInput = document.getElementById('game-search');
  const searchClear = document.getElementById('search-clear');

  function element(tagName, className, text) {
    const result = document.createElement(tagName);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }

  function createGameCard(game) {
    const playable = (game.status === 'available' || game.status === 'beta') && typeof game.url === 'string' && /^https:\/\//.test(game.url);
    const card = element('article', `game-card game-${game.id}`);
    const visual = element('div', 'game-card-visual');
    const picture = element('img', 'game-illustration');
    picture.src = game.image;
    picture.alt = game.imageAlt;
    picture.loading = 'lazy';
    picture.width = 284;
    picture.height = 200;
    visual.append(picture);
    const detail = element('div', 'game-card-detail');
    detail.append(element('span', `status-label ${game.status === 'beta' ? 'status-beta' : playable ? 'status-open' : 'status-soon'}`, game.status === 'beta' ? '測試開放' : playable ? '開放遊玩' : '製作中'));
    detail.append(element('h3', '', game.name));
    detail.append(element('p', 'game-description', game.summary));
    detail.append(element('small', 'game-category', game.category));
    if (playable) {
      const link = element('a', 'game-entry', game.status === 'beta' ? '進入測試版 →' : '立即進入 →');
      link.href = game.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `開啟${game.name}遊戲（新分頁）`);
      detail.append(link);
    } else {
      const badge = element('span', 'game-entry disabled', '⏳ 製作中');
      badge.setAttribute('aria-label', `${game.name}仍在製作中，暫時無法進入`);
      detail.append(badge);
    }
    card.append(visual, detail);
    return card;
  }

  function createClubCard() {
    const card = element('aside', 'welcome-card');
    const picture = element('img', 'welcome-card-art');
    picture.src = 'assets/club-welcome.webp';
    picture.alt = '三毛探出頭來歡迎朋友加入遊戲中心';
    picture.loading = 'lazy';
    picture.width = 172;
    picture.height = 146;
    const heading = element('h3', '', '三毛和朋友的遊戲小天地');
    const copy = element('p', '', '一起玩遊戲、交朋友、收集歡笑。每一局，都是開心的開始！');
    card.append(picture, heading, copy);
    return card;
  }

  function renderGames(filter='') {
    if (!gameList) return;
    if (!Array.isArray(games)) {
      gameList.replaceChildren(element('p', 'load-message', '遊戲清單目前無法載入。'));
      return;
    }
    const keyword = filter.trim().toLocaleLowerCase('zh-Hant');
    const matches = games.filter(game => `${game.name} ${game.category} ${game.summary}`.toLocaleLowerCase('zh-Hant').includes(keyword));
    if (!matches.length) {
      gameList.replaceChildren(element('p','empty-message','沒有找到這款遊戲，試試其他名稱吧！'));
      return;
    }
    gameList.replaceChildren(...matches.map(createGameCard), ...(keyword ? [] : [createClubCard()]));
  }

  function setSearchOpen(isOpen) {
    searchPanel.hidden = !isOpen;
    searchToggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) searchInput.focus();
    else {
      searchInput.value = '';
      renderGames();
      searchToggle.focus();
    }
  }
  searchToggle.addEventListener('click', () => setSearchOpen(searchPanel.hidden));
  searchClear.addEventListener('click', () => { searchInput.value = ''; renderGames(); searchInput.focus(); });
  searchInput.addEventListener('input', () => renderGames(searchInput.value));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !searchPanel.hidden) setSearchOpen(false);
  });
  document.getElementById('year').textContent = String(new Date().getFullYear());
  renderGames();
})();
