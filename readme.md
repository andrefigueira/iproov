# iProov WebCodecs Technical Evaluation

## Requirements

- **Browser:** Chrome (Desktop or Android) - WebCodecs is Chrome-only
- **Node.js:** v16 or higher
- **OpenAI API Key:** Optional, for face detection feature

## Installation

```bash
npm install
```

## Configuration (Optional)

For face detection with OpenAI, create a `.env.local` file:

```bash
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

If no API key is provided, the app will prompt you or skip face detection.

## Running the Application

```bash
npm run dev
```

Open the provided URL (usually `http://localhost:5173`) in **Chrome**.

## Usage

1. Click the "Start" button
2. Grant camera permissions when prompted
3. The app will:
   - Select your best front-facing camera
   - Flash the screen black/white 20 times over 10 seconds
   - Capture and encode frames synchronized with flashes
   - Decode and play back the encoded video
   - Validate frames with AI (if OpenAI key provided)
4. View results and validation details on screen

## Development Timeline

Started @ 17:40
Finished @ 18:17

1. Read about WebCodecs
2. Created the project, and asked Claude to take me into a deep dive into Codecs and how it works, decided to do a very basic frameworkless/libraryless implementation
3. Wrote out the basic structure for the application using typescript and also used pseudocomments, also commented everything as I would build it as placeholders until I added code
4. Finished writing out my initial implementation then validated my approach with Claude, Also used claude to write unit tests for me and to add in linting and a few other goodies.
5. Testing and adjustments until I got it working.
6. Bonus, once I got it working, I added an extra step and used openAI for basic validation of the image to confirm the user is facing the camera, and also if they are wearing headwear or glasses.
7. Went through and validated and tried to spot potential issues

## Other Commands

```bash
npm run build      # Build for production
npm run preview    # Preview production build
npm run test       # Run unit tests
npm run lint       # Lint code
```