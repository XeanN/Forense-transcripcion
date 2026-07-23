function saveSession(token, user) {
  localStorage.setItem('forense_token', token);
  localStorage.setItem('forense_user', JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem('forense_token');
}

function getUser() {
  const raw = localStorage.getItem('forense_user');
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem('forense_token');
  localStorage.removeItem('forense_user');
}

function requireSession(expectedRole) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    window.location.href = '/login/index.html';
    return null;
  }
  if (expectedRole && user.role !== expectedRole) {
    window.location.href = user.role === 'admin' ? '/admin-dashboard/index.html' : '/user-dashboard/index.html';
    return null;
  }
  return user;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, Object.assign({}, options, { headers }));

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login/index.html';
    throw new Error('Sesion expirada');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error inesperado');
  }
  return data;
}
