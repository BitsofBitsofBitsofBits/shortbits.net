const notificationStorageKey = "bits-notifications-v1";
const notificationLimit = 50;
const notificationsWindow = document.querySelector("#notifications-window");
const notificationUnreadCount = document.querySelector("#notification-unread-count");
const notificationsList = document.querySelector("#notifications-list");
const notificationsEmpty = document.querySelector("#notifications-empty");
const notificationsClear = document.querySelector("#notifications-clear");
const notificationToasts = document.querySelector("#notification-toasts");
const validNotificationTypes = new Set([
  "info",
  "success",
  "warning",
  "achievement",
]);

function isValidStoredNotification(notification) {
  return notification
    && typeof notification.id === "string"
    && typeof notification.title === "string"
    && notification.title.length > 0
    && notification.title.length <= 120
    && typeof notification.message === "string"
    && notification.message.length > 0
    && notification.message.length <= 500
    && validNotificationTypes.has(notification.type)
    && typeof notification.createdAt === "string"
    && Number.isFinite(Date.parse(notification.createdAt))
    && typeof notification.read === "boolean"
    && (
      notification.dedupeKey === null
      || typeof notification.dedupeKey === "string"
    );
}

function loadNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(notificationStorageKey) || "[]");
    if (!Array.isArray(stored)) {
      throw new Error("Stored notification history is not an array.");
    }
    const valid = stored.filter(isValidStoredNotification);
    if (valid.length !== stored.length) {
      console.warn("Discarded malformed notification history entries.");
    }
    return valid.slice(-notificationLimit);
  } catch (error) {
    console.error("Unable to load notification history:", error);
    return [];
  }
}

let notifications = loadNotifications();

function saveNotifications() {
  try {
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
  } catch (error) {
    console.error("Unable to save notification history:", error);
  }
}

function updateNotificationUnreadCount() {
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  notificationUnreadCount.textContent = String(unreadCount);
  notificationUnreadCount.closest("button")?.classList.toggle(
    "has-unread-notifications",
    unreadCount > 0,
  );
}

function dismissNotification(id) {
  notifications = notifications.filter((notification) => notification.id !== id);
  notificationToasts.querySelectorAll("[data-notification-id]").forEach((toast) => {
    if (toast.dataset.notificationId === id) {
      toast.remove();
    }
  });
  saveNotifications();
  renderNotifications();
}

function clearNotifications() {
  notifications = [];
  notificationToasts.replaceChildren();
  saveNotifications();
  renderNotifications();
}

function createNotificationItem(notification) {
  const item = document.createElement("li");
  const header = document.createElement("header");
  const identity = document.createElement("div");
  const type = document.createElement("span");
  const title = document.createElement("strong");
  const timestamp = document.createElement("time");
  const message = document.createElement("p");
  const dismiss = document.createElement("button");

  item.dataset.type = notification.type;
  item.classList.toggle("is-unread", !notification.read);
  type.textContent = notification.type.toUpperCase();
  title.textContent = notification.title;
  timestamp.dateTime = notification.createdAt;
  timestamp.textContent = new Date(notification.createdAt).toLocaleString();
  message.textContent = notification.message;
  dismiss.type = "button";
  dismiss.textContent = "DISMISS";
  dismiss.setAttribute("aria-label", `Dismiss ${notification.title}`);
  dismiss.addEventListener("click", () => dismissNotification(notification.id));

  identity.append(type, title);
  header.append(identity, timestamp);
  item.append(header, message, dismiss);
  return item;
}

function renderNotifications() {
  const orderedNotifications = [...notifications].reverse();
  notificationsList.replaceChildren(
    ...orderedNotifications.map(createNotificationItem),
  );
  notificationsEmpty.hidden = orderedNotifications.length > 0;
  notificationsClear.disabled = orderedNotifications.length === 0;
  updateNotificationUnreadCount();
}

function markNotificationsRead() {
  let changed = false;
  notifications.forEach((notification) => {
    if (!notification.read) {
      notification.read = true;
      changed = true;
    }
  });
  if (changed) {
    saveNotifications();
    renderNotifications();
  }
}

function showNotificationToast(notification) {
  const toast = document.createElement("article");
  const copy = document.createElement("div");
  const type = document.createElement("span");
  const title = document.createElement("strong");
  const message = document.createElement("p");
  const dismiss = document.createElement("button");
  let removalTimer;

  toast.className = "notification-toast";
  toast.dataset.type = notification.type;
  toast.dataset.notificationId = notification.id;
  toast.role = "status";
  type.textContent = notification.type.toUpperCase();
  title.textContent = notification.title;
  message.textContent = notification.message;
  dismiss.type = "button";
  dismiss.textContent = "×";
  dismiss.setAttribute("aria-label", `Dismiss ${notification.title} notification`);

  function removeToast() {
    window.clearTimeout(removalTimer);
    toast.remove();
  }

  dismiss.addEventListener("click", removeToast);
  copy.append(type, title, message);
  toast.append(copy, dismiss);
  notificationToasts.prepend(toast);
  while (notificationToasts.children.length > 3) {
    notificationToasts.lastElementChild.remove();
  }
  removalTimer = window.setTimeout(removeToast, 5200);
}

function createNotificationId() {
  return window.crypto?.randomUUID?.()
    ?? `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notify({
  title,
  message,
  type = "info",
  dedupeKey = null,
  toast = true,
} = {}) {
  const normalizedTitle = String(title || "").trim();
  const normalizedMessage = String(message || "").trim();
  const normalizedType = validNotificationTypes.has(type) ? type : "info";
  const normalizedDedupeKey = dedupeKey ? String(dedupeKey) : null;

  if (!normalizedTitle || !normalizedMessage) {
    throw new Error("Notifications require a title and message.");
  }
  if (
    normalizedDedupeKey
    && notifications.some((notification) => (
      notification.dedupeKey === normalizedDedupeKey
    ))
  ) {
    return null;
  }

  const notification = {
    id: createNotificationId(),
    title: normalizedTitle.slice(0, 120),
    message: normalizedMessage.slice(0, 500),
    type: normalizedType,
    createdAt: new Date().toISOString(),
    read: !notificationsWindow.hidden,
    dedupeKey: normalizedDedupeKey,
  };
  notifications.push(notification);
  notifications = notifications.slice(-notificationLimit);
  saveNotifications();
  renderNotifications();
  if (toast) {
    showNotificationToast(notification);
  }
  return notification.id;
}

notificationsClear.addEventListener("click", () => {
  if (!notifications.length) {
    return;
  }
  if (!window.confirm("Clear all saved notifications?")) {
    return;
  }
  clearNotifications();
});

window.addEventListener("desktop-window:opened", (event) => {
  if (event.detail?.windowId === "notifications-window") {
    markNotificationsRead();
  }
});

window.addEventListener("bits:appearance-changed", (event) => {
  const { label, value } = event.detail || {};
  if (!label || !value) {
    return;
  }
  notify({
    title: `${label} UPDATED`,
    message: value,
    type: "info",
  });
});

window.addEventListener("bits:preferences-changed", (event) => {
  const { key, value } = event.detail || {};
  if (!key || !value) {
    return;
  }
  notify({
    title: "PREFERENCE UPDATED",
    message: `${key.replaceAll("-", " ").toUpperCase()}: ${String(value).toUpperCase()}`,
    type: "success",
  });
});

window.BITS_NOTIFICATIONS = {
  notify,
  open: () => window.BITS_DESKTOP_WINDOWS?.open("notifications"),
  markAllRead: markNotificationsRead,
  clear: clearNotifications,
  getAll: () => notifications.map((notification) => ({ ...notification })),
};

renderNotifications();
