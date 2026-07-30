export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateContactForm(values) {
  const errors = {};

  if (!values.name.trim()) errors.name = 'Name is required.';
  if (!isEmail(values.email)) errors.email = 'Enter a valid email address.';
  if (!values.message.trim() || values.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters.';
  }
  if (values.phone && !/^\+?[0-9\s-]{8,18}$/.test(values.phone)) {
    errors.phone = 'Enter a valid phone number.';
  }

  return errors;
}
