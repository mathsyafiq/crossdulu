// All copy is written fresh for this project. English only.
export const SITE_NAME = "Crossdulu";

export const SLUGS = { home: "", editor: "editor", privacy: "privacy", terms: "terms" } as const;
export type PageKey = keyof typeof SLUGS;

export const path = (page: PageKey) => {
  const s = SLUGS[page];
  const root = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return s ? `${root}/${s}/` : `${root}/`;
};

export interface EditorStrings {
  consentTitle: string;
  consentBody: string;
  consentPoints: string[];
  consentOk: string;
  consentMore: string;
  consentBack: string;
  front: string;
  back: string;
  choose: string;
  camera: string;
  replace: string;
  remove: string;
  drop: string;
  errType: string;
  errSize: string;
  errDecode: string;
  needBoth: string;
  textLabel: string;
  textHint: string;
  presetsLabel: string;
  presets: string[];
  addDate: string;
  opacity: string;
  angle: string;
  size: string;
  colour: string;
  colourNames: string[];
  warnEmpty: string;
  warnFaint: string;
  warnHeavy: string;
  warnSmall: string;
  exportPng: string;
  exportPdf: string;
  working: string;
  done: string;
  failed: string;
  fileName: string;
  previewFront: string;
  previewBack: string;
  staysHere: string;
  position: string;
  positionCorner: string;
  positionMiddle: string;
  moveX: string;
  moveY: string;
  cornerNote: string;
  cameraTitle: string;
  cameraPreview: string;
  cameraStarting: string;
  cameraHint: string;
  cameraCapture: string;
  cameraCancel: string;
  cameraError: string;
  cameraDenied: string;
  cameraNone: string;
  cameraBusy: string;
  cameraOther: string;
  cameraRetry: string;
  cameraFallback: string;
  cameraFallbackDesktop: string;
  pdfChoose: string;
  pdfHint: string;
  pdfWorking: string;
  pdfSplit: string;
  pdfOne: string;
  swap: string;
  errPdf: string;
  errPdfPassword: string;
}

interface Dict {
  htmlLang: string;
  nav: { editor: string; privacy: string; terms: string; skip: string };
  footer: string;
  home: {
    title: string;
    description: string;
    h1: string;
    lead: string;
    cta: string;
    ctaNote: string;
    sampleAlt: string;
    sampleText: string;
    stepsTitle: string;
    steps: { h: string; p: string }[];
    trustTitle: string;
    trustLead: string;
    trust: { h: string; p: string }[];
    privacyLink: string;
    whyTitle: string;
    why: string;
    mkn: string;
    faqTitle: string;
    faq: { q: string; a: string }[];
    closing: string;
  };
  editor: { title: string; description: string; h1: string; lead: string; t: EditorStrings };
  privacy: { title: string; description: string; h1: string; sections: { h: string; p: string[] }[] };
  terms: { title: string; description: string; h1: string; updated: string; sections: { h: string; p: string[] }[] };
}

export const dict: Dict = {
  htmlLang: "en-MY",
  nav: { editor: "Editor", privacy: "Privacy", terms: "Terms", skip: "Skip to content" },
  footer: "A free tool. Your images are processed in your browser and are not sent anywhere.",
  home: {
    title: `${SITE_NAME}: watermark your IC copy in the browser, free`,
    description: "Write the purpose and date across the front and back of your IC copy, right in the browser. Free, no account, nothing uploaded. Save as PNG or PDF.",
    h1: "Mark your IC copy before you send it.",
    lead: "Write who the copy is for and when, across the front and back of your card. Everything runs in your browser, so the photo never leaves your phone or computer.",
    cta: "Watermark a copy",
    ctaNote: "Free, no account, nothing uploaded.",
    sampleAlt: "An example ID card copy with red text written diagonally across its top-left corner.",
    sampleText: "FOR TENANCY USE ONLY 17/11/2026",
    stepsTitle: "How it works",
    steps: [
      { h: "Add both sides", p: "Take a photo of the card, pick one from your gallery, or upload a PDF copy you already have." },
      { h: "Say what it is for", p: "Type the purpose and the recipient. Today's date goes in with one tap." },
      { h: "Download", p: "Save a PNG or a PDF with both sides, ready to send." },
    ],
    trustTitle: "Your card stays on your device.",
    trustLead: "Most online tools upload your photo to a server. This one is built so it cannot.",
    trust: [
      { h: "Processed in your browser", p: "The image is read and drawn on your own device. There is no server that receives it." },
      { h: "Blocked from the network", p: "The page carries a security rule that stops it making any connection once it has loaded. You can check the Network tab in your browser's developer tools." },
      { h: "Gone when you close it", p: "No account and no history. Close or reload the page and the images are cleared." },
    ],
    privacyLink: "Read how privacy works",
    whyTitle: "Why mark a copy at all?",
    why: "An unmarked IC copy can be reused for something you never agreed to. Writing the purpose and the date across it makes the copy much harder to misuse.",
    mkn: "Read the National Security Council advice (in Malay)",
    faqTitle: "Questions",
    faq: [
      { q: "Is it really free?", a: "Yes, with no limits and no account." },
      { q: "Is my IC image uploaded?", a: "No. Everything happens in your browser. See the privacy page for details." },
      { q: "Can I use my phone?", a: "Yes. Open this page in your phone browser, take a photo of the card or pick one, then download the result." },
      { q: "Does it work for other documents?", a: "Yes, for example a driving licence or a payslip. Only use documents you have the right to use." },
    ],
    closing: "It takes about a minute.",
  },
  editor: {
    title: `Editor: ${SITE_NAME}`,
    description: "Add the front and back of your ID, type the watermark text, and download a PNG or PDF. All in the browser.",
    h1: "Editor",
    lead: "Add both sides of the card. The watermark settings appear after that.",
    t: {
      consentTitle: "Before you start",
      consentBody: "Your images are processed entirely in this browser.",
      consentPoints: [
        "Images are not sent, not stored and never seen by us.",
        "Close or reload the page and the images are gone.",
        "You are responsible for the copy you download and who you send it to.",
      ],
      consentOk: "I understand, continue",
      consentMore: "Read the full privacy explanation",
      consentBack: "Back to home",
      front: "Front of card",
      back: "Back of card",
      choose: "Choose image",
      camera: "Use camera",
      replace: "Replace",
      remove: "Remove",
      drop: "or drop an image here",
      errType: "That file is not an image. Use JPG, PNG or WebP.",
      errSize: "File is too large. The limit is 25 MB.",
      errDecode: "The image could not be read. Try saving it as JPG or PNG.",
      needBoth: "Add both the front and the back to open the watermark settings.",
      textLabel: "Watermark text",
      textHint: "Purpose, recipient and date, for example: FOR BANK ABC ONLY",
      presetsLabel: "Examples",
      presets: ["FOR BANK USE ONLY", "FOR JOB APPLICATION ONLY", "FOR RENTAL USE ONLY", "NOT FOR ANY OTHER USE"],
      addDate: "Add today's date",
      opacity: "Opacity",
      angle: "Angle",
      size: "Cross size",
      colour: "Watermark colour",
      colourNames: ["Red", "Black", "Blue"],
      warnEmpty: "Type the watermark text first.",
      warnFaint: "The watermark is too faint and easy to remove. Raise the opacity.",
      warnHeavy: "The watermark is very heavy and may hide card details. Lower it a little.",
      warnSmall: "A small cross covers less of the card and is easier to crop out. Make sure it still crosses the face and the number on the card.",
      exportPng: "Download PNG",
      exportPdf: "Download PDF",
      working: "Preparing the file...",
      done: "The file was downloaded. Check the watermark before you send it.",
      failed: "Could not create the file. Try a smaller image.",
      fileName: "watermarked-copy",
      previewFront: "Front preview",
      previewBack: "Back preview",
      staysHere: "Images stay in this browser.",
      position: "Band position",
      positionCorner: "Top-left corner",
      positionMiddle: "Across the middle",
      moveX: "Horizontal position (left to right)",
      moveY: "Vertical position (top to bottom)",
      cornerNote: "The band sits in the top-left corner of the card, on one line, and may run a little past the edge of the card. Check the preview and adjust Cross size so it does not cover the face, name or ID number. A corner band is easier to crop out: choose Across the middle for stronger protection.",
      cameraTitle: "Take a picture of the card",
      cameraPreview: "Camera view",
      cameraStarting: "Starting the camera...",
      cameraHint: "Put the card inside the white box. Keep it flat and well lit with all four edges visible, then press Take picture.",
      cameraCapture: "Take picture",
      cameraCancel: "Cancel",
      cameraError: "The camera could not be opened.",
      cameraDenied: "Camera access is blocked for this site. Click the camera or padlock icon in the address bar, choose Allow, then press Try again. On a computer, also check that the browser may use the camera in the system privacy settings (Mac: System Settings > Privacy & Security > Camera; Windows: Settings > Privacy > Camera).",
      cameraNone: "No camera was found on this device. Choose a picture of the card instead.",
      cameraBusy: "The camera is being used by another app (for example Zoom, Teams or Meet). Close that app, then press Try again.",
      cameraOther: "Try again, or choose a picture of the card instead.",
      cameraRetry: "Try again",
      cameraFallback: "Use the phone's camera app",
      cameraFallbackDesktop: "Choose a picture instead",
      pdfChoose: "Upload a PDF of your ID copy",
      pdfHint: "Already have your ID copy as a PDF? Choose it and we separate the front and back.",
      pdfWorking: "Reading the PDF...",
      pdfSplit: "Found the front and back and separated them. Check the previews. If they are the wrong way round, press Swap front and back.",
      pdfOne: "Found one card in the PDF and added it. Add the other side.",
      swap: "Swap front and back",
      errPdf: "The PDF could not be read. Try saving it again as a PDF, or use a picture.",
      errPdfPassword: "This PDF is password protected. Open it and save a copy without a password first.",
    },
  },
  privacy: {
    title: `Privacy: ${SITE_NAME}`,
    description: "What happens to your images, what is stored and what is not.",
    h1: "Privacy",
    sections: [
      { h: "Your images", p: ["The images you choose are read and drawn in your browser. They are not sent to our server, and we do not store or see them. The file you download is created on your device.","If you use the camera, the picture is taken in your browser and is not sent anywhere; the camera is switched off as soon as the picture is taken. A PDF you choose is also read in your browser."] },
      { h: "How this is enforced", p: ["The editor page is served with a security policy that blocks any network connection from the page. Even if there were a bug in the code, the browser would not let the page send an image out. You can check the Network tab in your browser's developer tools: there are no requests after the page has loaded."] },
      { h: "What is stored", p: ["In your browser only: one marker that you have read the privacy notice. No tracking cookies. No accounts.", "The hosting provider may keep ordinary server logs (for example IP address and visit time) for security. These logs do not contain your images."] },
      { h: "After you download", p: ["The file is under your control. Make sure the watermark is clear before you share, and share only with people who need it. No tool can guarantee a copy will not be misused."] },
    ],
  },
  terms: {
    title: `Terms: ${SITE_NAME}`,
    description: "Terms of use for the free watermark tool.",
    h1: "Terms of use",
    updated: "Updated: 10 November 2026",
    sections: [
      { h: "What the tool does", p: ["The tool places watermark text on images you choose, in your browser. It is provided free as a convenience, not as legal or security advice."] },
      { h: "Allowed use", p: ["Use only your own documents, or documents you are entitled to use with the owner's permission.", "Do not use the tool for fraud, impersonation, forging or altering documents, or to write watermark text that misleads the recipient about the real purpose of the copy."] },
      { h: "Your responsibility", p: ["You are responsible for the files you create and who you send them to. We have no copy and cannot recall a file."] },
      { h: "No warranty", p: ["The tool is provided as is, with no promise that it meets your needs or prevents every misuse. To the extent the law allows, we are not liable for loss arising from its use."] },
      { h: "Law", p: ["These terms are governed by the laws of Malaysia."] },
    ],
  },
};
