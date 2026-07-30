import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Toast } from './Toast';
import { contactService } from '../../services/contactService';
import { validateContactForm } from '../../utils/validators';

const initialValues = {
  name: '',
  email: '',
  phone: '',
  company: '',
  message: '',
};

export function ContactForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateContactForm(values);
    setErrors(nextErrors);
    setStatus({ type: '', message: '' });
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await contactService.submit(values);
      setValues(initialValues);
      setStatus({ type: 'success', message: 'Thanks. Our team will contact you shortly.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.friendlyMessage || 'Unable to submit your request.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Toast type={status.type} message={status.message} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="name" name="name" label="Name" value={values.name} onChange={updateField} error={errors.name} autoComplete="name" />
        <Input id="email" name="email" label="Email" value={values.email} onChange={updateField} error={errors.email} autoComplete="email" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="phone" name="phone" label="Phone" value={values.phone} onChange={updateField} error={errors.phone} autoComplete="tel" />
        <Input id="company" name="company" label="Company" value={values.company} onChange={updateField} autoComplete="organization" />
      </div>
      <Textarea id="message" name="message" label="Message" value={values.message} onChange={updateField} error={errors.message} />
      <Button type="submit" disabled={loading} className="w-full gap-2 sm:w-auto">
        <Send className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Sending...' : 'Send request'}
      </Button>
    </form>
  );
}
