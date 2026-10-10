document.addEventListener('DOMContentLoaded', () => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const grid = document.getElementById('worksGrid');
  if (grid) {
    fetch('/api/works')
      .then(response => response.json())
      .then(works => {
        grid.innerHTML = works.map(work => {
          const title = work[`title_${lang}`] || work.title_ru || 'Работа';
          const description = work[`desc_${lang}`] || work.desc_ru || '';
          const media = String(work.image || '');
          const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(media);
          const mediaHtml = isVideo
            ? `<video src="${esc(media)}" controls playsinline preload="metadata"></video>`
            : `<img src="${esc(media)}" alt="${esc(title)}" loading="lazy">`;
          return `<article class="work-card">${mediaHtml}<div class="work-body"><h3>${esc(title)}</h3><p class="muted">${esc(description)}</p><p class="price">${esc(work.price || '')}</p></div></article>`;
        }).join('') || '<p class="muted">Работы пока не добавлены.</p>';
      })
      .catch(() => { grid.innerHTML = '<p class="muted">Не удалось загрузить работы.</p>'; });
  }

  const contactsBox = document.getElementById('contactsBox');
  const footerContacts = document.getElementById('footerContacts');
  if (contactsBox || footerContacts) {
    fetch('/api/settings').then(r => r.json()).then(settings => {
      const rows = [
        ['phone', 'contacts_phone'], ['telegram', 'contacts_tg'],
        ['email', 'contacts_email'], ['address', 'contacts_address']
      ];
      if (contactsBox) {
        contactsBox.innerHTML = rows
          .filter(([key]) => settings[key])
          .map(([key, label]) => `<div class="contact-card"><b>${esc(I18N[lang][label] || label)}:</b> ${esc(settings[key])}</div>`)
          .join('') || '<p class="muted">Контакты пока не добавлены.</p>';
      }
      if (footerContacts) {
        footerContacts.textContent = [settings.phone, settings.telegram].filter(Boolean).join(' · ');
      }
    }).catch(() => {});
  }

  const questionsBox = document.getElementById('questionsBox');
  if (questionsBox) {
    fetch('/api/questions').then(r => r.json()).then(questions => {
      questionsBox.innerHTML = questions.map(question => {
        const label = question[`text_${lang}`] || question.text_ru || 'Вопрос';
        let input;
        let options = [];
        try { options = JSON.parse(question.options || '[]'); } catch (_) {}
        if (question.type === 'select') {
          input = `<select data-q="${Number(question.id)}"><option value="">Выберите вариант</option>${options.map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join('')}</select>`;
        } else if (question.type === 'number') {
          input = `<input type="number" data-q="${Number(question.id)}">`;
        } else {
          input = `<textarea data-q="${Number(question.id)}" rows="3"></textarea>`;
        }
        return `<div class="q-block"><label for="q-${Number(question.id)}">${esc(label)}</label>${input.replace('data-q=', `id="q-${Number(question.id)}" data-q=`)}</div>`;
      }).join('') || '<p class="muted">Дополнительных вопросов пока нет.</p>';
    }).catch(() => { questionsBox.innerHTML = '<p class="muted">Не удалось загрузить вопросы.</p>'; });
  }

  const submit = document.getElementById('submitOrder');
  if (submit) {
    submit.addEventListener('click', async () => {
      const result = document.getElementById('orderResult');
      const contactValue = document.getElementById('contactValue').value.trim();
      if (!contactValue) {
        result.textContent = 'Укажите контакт для связи.';
        return;
      }
      const fd = new FormData();
      const answers = [...document.querySelectorAll('[data-q]')].map(el => {
        const label = el.closest('.q-block')?.querySelector('label')?.textContent || `Вопрос ${el.dataset.q}`;
        return `${label}: ${el.value}`;
      }).join('\n');
      fd.append('answers', answers);
      fd.append('contact_type', document.getElementById('contactType').value);
      fd.append('contact_value', contactValue);
      fd.append('email', document.getElementById('email').value.trim());
      [...document.getElementById('files').files].forEach(file => fd.append('files', file));

      submit.disabled = true;
      result.textContent = 'Отправка…';
      try {
        const response = await fetch('/api/order', { method: 'POST', body: fd });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось отправить заказ');
        result.textContent = I18N[lang].order_success + ` №${data.id}`;
        document.getElementById('contactValue').value = '';
      } catch (error) {
        result.textContent = error.message || 'Ошибка отправки заказа.';
      } finally {
        submit.disabled = false;
      }
    });
  }
});
