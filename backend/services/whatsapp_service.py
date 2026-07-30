import logging

import requests
from django.conf import settings
from twilio.rest import Client

from apps.communications.models import WhatsAppLog

logger = logging.getLogger(__name__)


class WhatsAppService:
    def send(self, name, phone, message):
        if settings.WHATSAPP_PROVIDER == 'meta':
            return self._send_with_meta(name, phone, message)
        return self._send_with_twilio(name, phone, message)

    def _send_with_twilio(self, name, phone, message):
        log = WhatsAppLog.objects.create(name=name, phone=phone, message=message, provider='twilio')
        try:
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            result = client.messages.create(
                from_=settings.TWILIO_WHATSAPP_NUMBER,
                to=f'whatsapp:{phone}' if not phone.startswith('whatsapp:') else phone,
                body=message,
            )
            log.provider_message_id = result.sid
            log.status = WhatsAppLog.Status.SENT
            log.save(update_fields=['provider_message_id', 'status', 'updated_at'])
            return log
        except Exception as exc:
            logger.exception('Twilio WhatsApp delivery failed')
            log.status = WhatsAppLog.Status.FAILED
            log.error_message = str(exc)
            log.save(update_fields=['status', 'error_message', 'updated_at'])
            raise

    def _send_with_meta(self, name, phone, message):
        log = WhatsAppLog.objects.create(name=name, phone=phone, message=message, provider='meta')
        url = f'https://graph.facebook.com/v20.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages'
        headers = {
            'Authorization': f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}',
            'Content-Type': 'application/json',
        }
        payload = {
            'messaging_product': 'whatsapp',
            'to': phone,
            'type': 'text',
            'text': {'body': message},
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            log.provider_message_id = data.get('messages', [{}])[0].get('id', '')
            log.status = WhatsAppLog.Status.SENT
            log.save(update_fields=['provider_message_id', 'status', 'updated_at'])
            return log
        except Exception as exc:
            logger.exception('Meta WhatsApp delivery failed')
            log.status = WhatsAppLog.Status.FAILED
            log.error_message = str(exc)
            log.save(update_fields=['status', 'error_message', 'updated_at'])
            raise
