# WhisperBox 

A secure, End-to-End Encrypted (E2EE) messaging application built with Next.js, TypeScript, and the native Web Crypto API. This project was developed as part of the HNG Stage 4 (Task 4B) requirements to demonstrate advanced client-side cryptography.

## Features

* **True End-to-End Encryption:** Messages are encrypted in the browser before being sent to the server. The backend never sees plaintext messages or private keys.
* **Hybrid Encryption System:** Utilizes **AES-GCM** for fast message encryption and **RSA-OAEP** for secure key exchange.
* **Secure Key Storage:** Private keys are wrapped (encrypted) using **AES-KW** derived from a user's master password via **PBKDF2**, ensuring keys can be safely stored on the backend and retrieved across devices.
* **"Double Lock" Payload:** Senders encrypt the message key with both the recipient's public key and their own, allowing both parties to read the chat history.

##  Tech Stack

* **Frontend:** Next.js (React), Tailwind CSS, TypeScript
* **Cryptography:** Native browser Web Crypto API (`window.crypto.subtle`)
* **Backend:** Koyeb API (`whisperbox.koyeb.app`) via REST

##  How the Cryptography Works (The "Typical Flow")

### 1. Registration & Key Generation
When a new user registers, the client:
1. Generates a fresh **RSA-OAEP (2048-bit)** key pair.
2. Derives a strong wrapping key from the user's password and a random salt using **PBKDF2**.
3. Wraps the RSA Private Key using **AES-KW**.
4. Sends the Public Key, Wrapped Private Key, and Salt to the server. The raw Private Key *never* leaves the browser.

### 2. Authentication & Key Unwrapping
When logging in, the client:
1. Receives the Wrapped Private Key and Salt from the server's Auth payload.
2. Re-derives the AES-KW wrapping key using the inputted password.
3. Unwraps the RSA Private Key into memory for the active session.

### 3. Sending an Encrypted Message
To send a message, the client:
1. Generates a random, single-use **AES-GCM** key.
2. Encrypts the plaintext message with this AES key.
3. Retrieves the recipient's RSA Public Key from the server.
4. Encrypts the single-use AES key twice (The "Double Lock"):
   - Once with the **Recipient's Public Key** (so they can read it).
   - Once with the **Sender's Public Key** (so the sender can read their own sent messages).
5. Sends the AES ciphertext, IV, and both encrypted keys to the server as an opaque blob.

## Local Setup

1. Clone the repository:
   ```bash
   git clone <https://github.com/Muha-coder-dev/hng14-task4b-whisper-chat>