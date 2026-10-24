// Shared helpers for the demo pages.

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Empty or non-JSON response body.
  }
  return { status: response.status, ok: response.ok, data };
}

// Returns the signed-in user, or sends the visitor to the login page.
async function requireUser() {
  const { status, data } = await api('/api/me');
  if (status === 401) {
    window.location.href = '/login.html';
    return null;
  }
  return data.user;
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

function setFieldError(form, field, message) {
  const input = form.elements[field];
  const errorEl = form.querySelector(`#${field}-error`);
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (errorEl) errorEl.textContent = message || '';
}

function clearFieldErrors(form) {
  form.querySelectorAll('[id$="-error"]').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
}
