# AI Twin™ — Legal Drafts (FOR ATTORNEY REVIEW, decision D4)

These drafts are not legal advice. They must be reviewed by a licensed attorney before AI Twin™ is switched on for customers.
Points for counsel are marked **[COUNSEL]**.

---

## 1. Consent text, version `ai-twin-consent-v2`

The exact wording is in `lib/twinConsent.js`. Any change to it requires a new version number, and creators must then consent again.

**The creator confirms:**
1. The photos and recording they provide are of themselves, and they are 18 or older.
2. They authorize NillaFlow Studio™ to use these only to create AI-generated images of them, for the uses they select, for their own content.
3. They will not upload images of anyone else, and will not use their AI Twin to impersonate anyone or mislead people about who created the content.
4. Images created with their AI Twin are AI-generated and labeled as such. They are responsible for disclosing AI use where platforms or laws require it.
5. Their photos are processed by NillaFlow and its AI service providers only to provide this feature, and are not used to train public models.
6. **(New in v2)** Before an image is delivered, NillaFlow automatically compares it with their reference photos to check that it looks like them. The check produces only a likeness score; no face template or faceprint is created or stored.
7. They can delete their AI Twin at any time. Deletion permanently removes their photos, consent recording, and images created from them.

**Uses they can select:** professional branding; fashion and lifestyle. Video and voice are listed for later phases and cannot be selected yet.

**On-camera statement they read aloud:** "My name is [name]. Today is [date]. I am creating an AI Twin of myself in NillaFlow Studio, and I consent to the uses I selected."

**Stored with each consent:** consent version, selected uses, both confirmations, time signed, IP address, browser, and the on-camera recording.

- **[COUNSEL]** Whether a checkbox plus a recorded statement is enough under state right-of-publicity and digital-replica laws (for example California, New York, Tennessee's ELVIS Act, Illinois).
- **[COUNSEL]** Whether facial photos used to make a likeness count as "biometric" data under Illinois BIPA, Texas CUBI, Washington or similar laws. The system does **not** do face recognition or face matching; Claude only checks photo quality, one-person, adult appearance, and no explicit content.
- **[COUNSEL] Likeness check (v2, item 6).** Claude vision compares each generated image with up to 4 of the creator's own reference photos and returns a 0–100 likeness score. No embedding, template or identifier is computed or kept; only the score is stored. Confirm whether this transient comparison counts as collecting "biometric identifiers/information" under BIPA, CUBI, Washington and similar laws, and whether the written consent above (plus the privacy section) satisfies them.
- **[COUNSEL] Image service (fal.ai).** Reference photos are sent to fal.ai (and from there to Google or OpenAI models) as 10–15-minute private links. Generated images are briefly hosted on fal's servers before we copy them into private storage. Confirm the data-processing and retention terms, and whether we should request zero-retention.
- **[COUNSEL]** Item 5: confirm that our AI provider contracts support "not used to train public models".

---

## 2. Privacy Policy section (draft insert)

**AI Twin™ (optional feature)**

If you choose to create an AI Twin, we collect the reference photos you upload and a short consent video. We use them only to create AI-generated images of you that you request, for the uses you selected.

- **Screening and likeness check:** Each photo you upload is automatically checked by an AI service for image quality, that it shows one adult person, and that it is not explicit. Each image we create is automatically compared with your own reference photos to make sure it looks like you before we deliver it; this produces only a likeness score. We do not identify you, we never compare your face against other people, and we do not create or store a faceprint or face template.
- **Storage:** Photos, recordings and generated images are stored privately. They are visible only to you, through short-lived links.
- **Sharing:** We share them only with the service providers that run this feature (cloud storage and AI processing), under contracts limiting their use to providing the service.
- **Retention and deletion:** We keep them until you delete your AI Twin or your account. When you delete, we permanently remove your photos, consent recording, and generated images, and give you a deletion receipt. We keep a record that consent was given and later revoked, without the images, as proof of consent. **[COUNSEL]** Confirm retention period for this consent record.
- **Purchases:** Credit purchases are processed by Stripe. We record the amount of credits, not your card details.

**[COUNSEL]** State-specific notices (California CCPA/CPRA "sensitive personal information", BIPA-style written policy if counsel decides it applies).

---

## 3. Terms of Service section (draft insert)

**AI Twin™**

1. **Eligibility.** You must be 18 or older and on a plan that includes AI Twin.
2. **Only you.** You may create an AI Twin only of yourself. Uploading images of another person, a minor, or anyone who has not consented is prohibited and will result in deletion and account termination.
3. **Permitted use.** You may use images created with your AI Twin for the uses you selected. You may not use them to impersonate anyone, to deceive (including fake endorsements or fraudulent identity), for sexual or explicit content, or for political deception.
4. **Disclosure.** Generated images are AI-generated. You are responsible for any AI-content disclosure required by platforms you post to or laws that apply to you.
5. **Credits.** Credits are bought in packs, are used to create images, and have no cash value. **[COUNSEL]** Refund policy, expiry (if any), and consumer-law requirements for prepaid credits.
6. **Your rights.** You keep your rights in your likeness and your uploaded photos. You grant NillaFlow a limited license to process them solely to provide AI Twin to you, which ends when you delete your AI Twin.
7. **Removal.** We may remove content or suspend AI Twin access if we believe these terms are being violated.
8. **No guarantee.** Generated images may not be perfect likenesses.

---

## Open items before launch
- D1: final credit pricing (packs are placeholders in Stripe test mode).
- D3: Supabase Pro and Vercel Pro (Vercel Hobby is for non-commercial use only).
- D4: attorney sign-off on all three sections above.
