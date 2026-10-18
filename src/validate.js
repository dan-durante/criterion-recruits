export const LICENSE_STATUSES = [
  'Licensed',
  'In pre-licensing course',
  'Not yet started',
];

export const YEARS_LICENSED = ['Not yet', '<1', '1-2', '3-5', '5+'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Returns a map of field key → message. An empty object means the form is valid.
 */
export function validateInterest(data) {
  const errors = {};
  const name = String(data?.name ?? '').trim();
  const email = String(data?.email ?? '').trim();
  const phone = String(data?.phone ?? '');
  const message = String(data?.message ?? '');
  const phoneDigits = digitsOnly(phone);

  if (name.length < 2) {
    errors.name = 'Enter your name.';
  } else if (name.length > 120) {
    errors.name = 'Keep your name under 120 characters.';
  }

  if (!EMAIL.test(email) || email.length > 200) {
    errors.email = 'Enter a valid email address.';
  }

  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = 'Enter a phone number with at least 10 digits.';
  }

  if (!LICENSE_STATUSES.includes(data?.license_status)) {
    errors.license_status = 'Select your license status.';
  }

  if (!YEARS_LICENSED.includes(data?.years_licensed)) {
    errors.years_licensed = 'Select how long you have been licensed.';
  }

  if (message.length > 2000) {
    errors.message = 'Keep the note under 2,000 characters.';
  }

  if (data?.consent !== true) {
    errors.consent =
      'Agree to be contacted so the team can follow up.';
  }

  return errors;
}

export function buildPayload(data, attribution) {
  return {
    name: String(data.name ?? '').trim(),
    email: String(data.email ?? '').trim(),
    phone: String(data.phone ?? '').trim(),
    license_status: data.license_status,
    years_licensed: data.years_licensed,
    message: String(data.message ?? '').trim(),
    consent: true,
    ...attribution,
  };
}
