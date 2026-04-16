# FlashLearn

Desktop study app that turns documents into true/false flashcards and an AI audio lesson.

## Features

- Lead capture onboarding (name + email) via EmailJS
- Pollinations API key onboarding (GitHub auth or pasted key)
- Document ingestion: PDF, DOCX, TXT, MD, RTF, CSV, JSON
- AI flashcard generation (true/false + explanations)
- Swipeable flashcard deck (right = true, left = false)
- Audio lesson generation and playback
- MP3 download button for generated lesson audio
- Local persistence for docs and onboarding state

## AI + Audio Stack

- **Flashcard generation:** Pollinations `gemini-flash-lite-3.1` via `/v1/chat/completions`
- **Audio generation:** Pollinations audio endpoint with **`model=elevenlabs`** via `/audio/{text}`
- **API provider:** [pollinations.ai](https://pollinations.ai)

## Email lead capture

Configured through EmailJS in `script.js`:

- Service ID: `service_62v1xjs`
- Template ID: `template_issnglw`
- Public key: `JF-jcuIQR58xzQ4-0`

Template variables sent by app include:

- `user`, `user_email`
- `from_name`, `from_email`
- `name`, `email`
- `reply_to`, `subject`, `message`

## Run locally

```bash
npm install
npm run dev
```

## Branding

- Powered by Asquareportal
- https://www.asquareportal.com
