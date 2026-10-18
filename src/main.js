import '@fontsource-variable/outfit';
import './style.css';
import { readAttribution } from './attribution.js';
import { isSendableEndpoint, submitInterest } from './submit.js';
import { buildPayload, validateInterest } from './validate.js';

const FIELD_IDS = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  license_status: 'license-status',
  years_licensed: 'years-licensed',
  message: 'message',
  consent: 'consent',
};

const form = document.querySelector('#interest-form');
const formAlert = document.querySelector('#form-alert');
const success = document.querySelector('#form-success');
const submitButton = document.querySelector('#submit-interest');

function readConfig() {
  const config = window.CRITERION_CONFIG ?? {};
  return {
    endpoint: typeof config.FORM_ENDPOINT === 'string' ? config.FORM_ENDPOINT.trim() : '',
    headers: config.FORM_HEADERS,
  };
}

function readForm() {
  const data = new FormData(form);
  return {
    name: String(data.get('name') ?? ''),
    email: String(data.get('email') ?? ''),
    phone: String(data.get('phone') ?? ''),
    license_status: String(data.get('license_status') ?? ''),
    years_licensed: String(data.get('years_licensed') ?? ''),
    message: String(data.get('message') ?? ''),
    consent: document.querySelector('#consent')?.checked === true,
  };
}

function clearField(key) {
  const id = FIELD_IDS[key];
  const input = document.getElementById(id);
  const message = document.getElementById(`${id}-error`);
  const field = input?.closest('[data-field]');
  if (!input || !message || !field) return;
  message.textContent = '';
  message.hidden = true;
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
  delete field.dataset.invalid;
}

function showErrors(errors) {
  let firstInvalid = null;
  for (const key of Object.keys(FIELD_IDS)) {
    const id = FIELD_IDS[key];
    const input = document.getElementById(id);
    const message = document.getElementById(`${id}-error`);
    const field = input?.closest('[data-field]');
    const error = errors[key];
    if (!input || !message || !field) continue;
    if (error) {
      message.textContent = error;
      message.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', message.id);
      field.dataset.invalid = 'true';
      if (!firstInvalid) firstInvalid = input;
    } else {
      clearField(key);
    }
  }
  return firstInvalid;
}

function showFormError(text) {
  formAlert.textContent = text;
  formAlert.hidden = false;
}

function showSuccess(mode) {
  form.hidden = true;
  success.hidden = false;
  success.dataset.mode = mode;
  for (const node of success.querySelectorAll('[data-for]')) {
    node.hidden = node.getAttribute('data-for') !== mode;
  }
  success.focus();
}

let submitting = false;

async function handleSubmit() {
  if (submitting) return;
  formAlert.hidden = true;

  const values = readForm();
  const errors = validateInterest(values);
  const firstInvalid = showErrors(errors);
  if (firstInvalid) {
    showFormError('Please correct the highlighted fields.');
    firstInvalid.focus();
    return;
  }

  const { endpoint, headers } = readConfig();
  if (endpoint && !isSendableEndpoint(endpoint)) {
    showFormError('The form endpoint is not a valid http(s) URL. Nothing was sent.');
    return;
  }

  const payload = buildPayload(values, readAttribution(window.location.search));
  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Sending…';
  form.setAttribute('aria-busy', 'true');

  try {
    const result = await submitInterest(endpoint, headers, payload);
    if (result.mode === 'local') {
      console.log(
        '[Criterion recruiting] FORM_ENDPOINT is empty. Payload was not sent anywhere:',
        payload,
      );
    }
    showSuccess(result.mode);
  } catch (error) {
    console.error('[Criterion recruiting] The form could not be sent.', error);
    showFormError(
      'We could not send your note. Your answers are still in the form. Try again in a moment.',
    );
  } finally {
    submitting = false;
    form.removeAttribute('aria-busy');
    if (!form.hidden) {
      submitButton.disabled = false;
      submitButton.textContent = 'Express your interest';
    }
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  handleSubmit();
});

form?.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.id) return;
  const key = Object.keys(FIELD_IDS).find((name) => FIELD_IDS[name] === target.id);
  if (key) clearField(key);
  if (formAlert && !formAlert.hidden) formAlert.hidden = true;
});
