document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const loginBox = $('loginBox');
  const panel = $('adminPanel');
  const message = text => { $('adminMessage').textContent = text || ''; };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function checkLogin() {
    try {
      const state = await api('/api/me');
      if (state.admin) {
        loginBox.style.display = 'none';
        panel.style.display = 'flex';
        await loadAll();
      }
    } catch (_) {}
  }

  $('loginBtn').addEventListener('click', async () => {
    $('loginErr').textContent = '';
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('username').value, password: $('password').value })
      });
      loginBox.style.display = 'none';
      panel.style.display = 'flex';
      await loadAll();
    } catch (error) {
      $('loginErr').textContent = error.message || 'Неверный логин или пароль';
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
    panel.style.display = 'none';
    loginBox.style.display = 'flex';
  });

  async function loadAll() {
    try {
      const [works, questions, orders, settings] = await Promise.all([
        api('/api/works'), api('/api/questions'), api('/api/orders'), api('/api/settings')
      ]);
      $('worksList').innerHTML = works.map(work =>
        `<div class="contact-card"><b>${esc(work.title_ru || 'Работа')}</b> — ${esc(work.price || '')}<br><button type="button" data-delete-work="${Number(work.id)}">🗑 Удалить</button></div>`
      ).join('') || '<p class="muted">Работ пока нет.</p>';

      $('questionsList').innerHTML = questions.map(question =>
        `<div class="contact-card"><b>${esc(question.text_ru || 'Вопрос')}</b><br><button type="button" data-delete-question="${Number(question.id)}">🗑 Удалить</button></div>`
      ).join('') || '<p class="muted">Вопросов пока нет.</p>';

      $('ordersList').innerHTML = orders.map(order => {
        let uploaded = [];
        try { uploaded = JSON.parse(order.files || '[]'); } catch (_) {}
        const fileLinks = uploaded.map(file => `<a href="${esc(file)}" target="_blank" rel="noopener">Файл</a>`).join(', ');
        return `<div class="contact-card"><b>Заказ #${Number(order.id)}</b> · ${esc(order.status)}<p>${esc(order.contact_type)}: ${esc(order.contact_value)}</p><pre>${esc(order.answers)}</pre><p>${fileLinks || 'Без файлов'}</p><input id="reply-${Number(order.id)}" placeholder="Ответ клиенту"><button type="button" data-reply-order="${Number(order.id)}">➤ Ответить</button></div>`;
      }).join('') || '<p class="muted">Заказов пока нет.</p>';

      $('s_phone').value = settings.phone || '';
      $('s_telegram').value = settings.telegram || '';
      $('s_email').value = settings.email || '';
      $('s_address').value = settings.address || '';
    } catch (error) {
      message(`Ошибка загрузки: ${error.message}`);
    }
  }

  document.addEventListener('click', async event => {
    const workId = event.target.dataset.deleteWork;
    const questionId = event.target.dataset.deleteQuestion;
    const orderId = event.target.dataset.replyOrder;
    try {
      if (workId) {
        if (!confirm('Удалить эту работу?')) return;
        await api(`/api/works/${workId}`, { method: 'DELETE' });
        await loadAll();
      } else if (questionId) {
        if (!confirm('Удалить этот вопрос?')) return;
        await api(`/api/questions/${questionId}`, { method: 'DELETE' });
        await loadAll();
      } else if (orderId) {
        const reply = $(`reply-${orderId}`).value.trim();
        if (!reply) return message('Введите текст ответа.');
        await api(`/api/orders/${orderId}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: reply })
        });
        message('Ответ отправлен.');
      }
    } catch (error) {
      message(`Ошибка: ${error.message}`);
    }
  });

  $('addWork').addEventListener('click', async () => {
    const file = $('w_image').files[0];
    if (!file) return message('Выберите фото или видео.');
    const fd = new FormData();
    ['title_ru', 'title_uk', 'title_en', 'desc_ru', 'desc_uk', 'desc_en', 'price'].forEach(key => {
      fd.append(key, $(`w_${key}`).value);
    });
    fd.append('image', file);
    try {
      await api('/api/works', { method: 'POST', body: fd });
      message('Работа добавлена.');
      $('w_image').value = '';
      await loadAll();
    } catch (error) {
      message(`Не удалось добавить работу: ${error.message}`);
    }
  });

  $('addQuestion').addEventListener('click', async () => {
    const body = {
      text_ru: $('q_ru').value,
      text_uk: $('q_uk').value,
      text_en: $('q_en').value,
      type: $('q_type').value,
      options: $('q_options').value.split(',').map(value => value.trim()).filter(Boolean)
    };
    try {
      await api('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      ['q_ru', 'q_uk', 'q_en', 'q_options'].forEach(id => $(id).value = '');
      message('Вопрос добавлен.');
      await loadAll();
    } catch (error) {
      message(`Не удалось добавить вопрос: ${error.message}`);
    }
  });

  $('saveSettings').addEventListener('click', async () => {
    try {
      await api('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: $('s_phone').value,
          telegram: $('s_telegram').value,
          email: $('s_email').value,
          address: $('s_address').value
        })
      });
      message('Контакты сохранены.');
    } catch (error) {
      message(`Не удалось сохранить контакты: ${error.message}`);
    }
  });

  checkLogin();
});
