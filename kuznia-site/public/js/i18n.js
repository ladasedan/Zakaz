const I18N = {
  ru: {
    nav_home: "Главная", nav_order: "Заказать", nav_contact: "Контакты",
    hero_title: "Изделия ручной работы для дома и квартиры",
    hero_sub: "Верстаки, столы, мебель, декор — закажите что угодно. Золотые руки мастера — ваш идеальный результат.",
    hero_cta: "Рассчитать стоимость", gallery_title: "Примеры работ",
    order_title: "Оформление заказа", order_sub: "Ответьте на несколько вопросов — мы назовём ориентировочную цену и уточним детали.",
    order_examples: "Примеры (фото/видео)", order_contact: "Как с вами связаться?",
    order_contact_ph: "@username / +420... / email", order_email_ph: "Email для уведомлений (необязательно)",
    order_submit: "Отправить заказ", order_success: "✅ Заказ отправлен! Мы свяжемся с вами в ближайшее время.",
    contacts_phone: "Телефон", contacts_tg: "Telegram", contacts_email: "Email", contacts_address: "Адрес"
  },
  uk: {
    nav_home: "Головна", nav_order: "Замовити", nav_contact: "Контакти",
    hero_title: "Вироби ручної роботи для дому та квартири",
    hero_sub: "Верстати, столи, меблі, декор — замовляйте що завгодно. Золоті руки майстра — ваш ідеальний результат.",
    hero_cta: "Розрахувати вартість", gallery_title: "Приклади робіт",
    order_title: "Оформлення замовлення", order_sub: "Дайте відповіді на кілька питань — ми назвемо орієнтовну ціну та уточнимо деталі.",
    order_examples: "Приклади (фото/відео)", order_contact: "Як з вами зв'язатися?",
    order_contact_ph: "@username / +420... / email", order_email_ph: "Email для сповіщень (необов'язково)",
    order_submit: "Надіслати замовлення", order_success: "✅ Замовлення надіслано! Ми зв'яжемося з вами найближчим часом.",
    contacts_phone: "Телефон", contacts_tg: "Telegram", contacts_email: "Email", contacts_address: "Адреса"
  },
  en: {
    nav_home: "Home", nav_order: "Order", nav_contact: "Contacts",
    hero_title: "Handcrafted pieces for home and apartment",
    hero_sub: "Workbenches, tables, furniture, decor — order something made for you.",
    hero_cta: "Get a price estimate", gallery_title: "Portfolio",
    order_title: "Place an order", order_sub: "Answer a few questions and we'll clarify details and provide an estimate.",
    order_examples: "Examples (photo/video)", order_contact: "How can we contact you?",
    order_contact_ph: "@username / phone / email", order_email_ph: "Email for notifications (optional)",
    order_submit: "Submit order", order_success: "✅ Order sent! We'll contact you shortly.",
    contacts_phone: "Phone", contacts_tg: "Telegram", contacts_email: "Email", contacts_address: "Address"
  }
};

let lang = localStorage.getItem('lang') || 'ru';
if (!I18N[lang]) lang = 'ru';

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const value = I18N[lang][el.dataset.i18n];
    if (value) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const value = I18N[lang][el.dataset.i18nPh];
    if (value) el.placeholder = value;
  });
  document.documentElement.lang = lang;
  const selector = document.getElementById('lang');
  if (selector) selector.value = lang;
  document.dispatchEvent(new CustomEvent('langChanged', { detail: lang }));
}

document.addEventListener('DOMContentLoaded', () => {
  const selector = document.getElementById('lang');
  if (selector) {
    selector.value = lang;
    selector.addEventListener('change', event => {
      lang = event.target.value;
      localStorage.setItem('lang', lang);
      location.reload();
    });
  }
  applyI18n();
});
