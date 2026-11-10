// All copy is written fresh for this project. Working name only: replica-brand will replace it.
export type Lang = "ms" | "en";
export const LANGS: Lang[] = ["ms", "en"];
export const SITE_NAME = "Crossdulu";

export const SLUGS = {
  ms: { home: "", editor: "editor", privacy: "privasi", terms: "terma" },
  en: { home: "", editor: "editor", privacy: "privacy", terms: "terms" },
} as const;
export type PageKey = keyof (typeof SLUGS)["ms"];

export const path = (lang: Lang, page: PageKey) => {
  const s = SLUGS[lang][page];
  const root = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return s ? `${root}/${lang}/${s}/` : `${root}/${lang}/`;
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
  cornerNote: string;
  cameraTitle: string;
  cameraPreview: string;
  cameraStarting: string;
  cameraHint: string;
  cameraCapture: string;
  cameraCancel: string;
  cameraError: string;
  cameraFallback: string;
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
  nav: { editor: string; privacy: string; terms: string; skip: string; menu: string };
  footer: string;
  home: {
    title: string;
    description: string;
    h1: string;
    lead: string;
    cta: string;
    stepsTitle: string;
    steps: string[];
    whyTitle: string;
    why: string;
    mkn: string;
    trustTitle: string;
    trust: string[];
    faqTitle: string;
    faq: { q: string; a: string }[];
  };
  editor: { title: string; description: string; h1: string; lead: string; t: EditorStrings };
  privacy: { title: string; description: string; h1: string; sections: { h: string; p: string[] }[] };
  terms: { title: string; description: string; h1: string; updated: string; sections: { h: string; p: string[] }[] };
}

export const dict: Record<Lang, Dict> = {
  ms: {
    htmlLang: "ms-MY",
    nav: { editor: "Mula palang", privacy: "Privasi", terms: "Terma", skip: "Terus ke kandungan", menu: "Menu" },
    footer: "Alat percuma. Gambar anda diproses dalam browser dan tidak dihantar ke mana-mana.",
    home: {
      title: `${SITE_NAME}: palang salinan IC dalam browser, percuma`,
      description: "Palang salinan kad pengenalan depan dan belakang terus dalam browser. Percuma, tiada akaun, gambar tidak dimuat naik. Simpan sebagai PNG atau PDF.",
      h1: "Palang salinan kad pengenalan anda. Percuma, dan gambar tidak keluar dari peranti anda.",
      lead: "Letakkan palang pada salinan depan dan belakang, nyatakan tujuan dan tarikh, kemudian muat turun sebagai PNG atau PDF. Tiada akaun, tiada bayaran.",
      cta: "Mula palang sekarang",
      stepsTitle: "Tiga langkah",
      steps: ["Tambah gambar depan dan belakang kad", "Taip tujuan, penerima dan tarikh", "Muat turun sebagai PNG atau PDF"],
      whyTitle: "Kenapa perlu dipalang?",
      why: "Salinan kad pengenalan yang tiada tanda boleh digunakan semula untuk tujuan lain. Palang yang menyatakan tujuan dan tarikh menjadikan salinan itu sukar disalahguna.",
      mkn: "Baca nasihat Majlis Keselamatan Negara",
      trustTitle: "Apa yang berlaku pada gambar anda",
      trust: [
        "Gambar dipilih dari peranti anda dan diproses dalam browser sahaja.",
        "Halaman ini disediakan supaya ia tidak dapat menghantar gambar ke luar. Anda boleh semak sendiri.",
        "Tiada akaun. Selepas anda tutup atau muat semula halaman, gambar hilang.",
      ],
      faqTitle: "Soalan lazim",
      faq: [
        { q: "Adakah alat ini percuma?", a: "Ya, tanpa had dan tanpa akaun." },
        { q: "Adakah gambar IC saya dimuat naik?", a: "Tidak. Semua kerja dibuat dalam browser anda. Lihat halaman privasi untuk butiran." },
        { q: "Boleh guna telefon?", a: "Boleh. Buka halaman ini di browser telefon, pilih gambar atau ambil gambar kad, kemudian muat turun hasilnya." },
        { q: "Boleh untuk dokumen lain?", a: "Boleh, contohnya lesen memandu atau slip gaji. Gunakan hanya dokumen yang anda berhak guna." },
      ],
    },
    editor: {
      title: `Editor palang: ${SITE_NAME}`,
      description: "Tambah gambar IC depan dan belakang, taip teks palang, dan muat turun PNG atau PDF. Semua dalam browser.",
      h1: "Editor palang",
      lead: "Tambah kedua-dua belah kad. Tetapan palang akan muncul selepas itu.",
      t: {
        consentTitle: "Sebelum anda mula",
        consentBody: "Gambar anda diproses sepenuhnya dalam browser ini.",
        consentPoints: [
          "Gambar tidak dihantar, tidak disimpan dan tidak dilihat oleh kami.",
          "Tutup atau muat semula halaman dan gambar hilang.",
          "Anda bertanggungjawab ke atas salinan yang anda muat turun dan kepada siapa anda hantar.",
        ],
        consentOk: "Saya faham, teruskan",
        consentMore: "Baca penjelasan privasi penuh",
        consentBack: "Kembali ke laman utama",
        front: "Depan kad",
        back: "Belakang kad",
        choose: "Pilih gambar",
        camera: "Guna kamera",
        replace: "Tukar",
        remove: "Buang",
        drop: "atau seret gambar ke sini",
        errType: "Fail ini bukan gambar. Guna JPG, PNG atau WebP.",
        errSize: "Fail terlalu besar. Had 25 MB.",
        errDecode: "Gambar tidak dapat dibaca. Cuba simpan sebagai JPG atau PNG.",
        needBoth: "Tambah kedua-dua depan dan belakang untuk membuka tetapan palang.",
        textLabel: "Teks palang",
        textHint: "Tujuan, penerima dan tarikh, contohnya: KHAS UNTUK BANK ABC SAHAJA",
        presetsLabel: "Contoh teks",
        presets: ["KHAS UNTUK BANK SAHAJA", "KHAS UNTUK PERMOHONAN KERJA", "KHAS UNTUK SEWA RUMAH", "BUKAN UNTUK KEGUNAAN LAIN"],
        addDate: "Tambah tarikh hari ini",
        opacity: "Kelegapan",
        angle: "Sudut",
        size: "Saiz palang",
        colour: "Warna palang",
        colourNames: ["Merah", "Hitam", "Biru"],
        warnEmpty: "Taip teks palang dahulu.",
        warnFaint: "Palang terlalu pudar dan mudah dibuang. Tinggikan kelegapan.",
        warnHeavy: "Palang terlalu pekat dan mungkin menutup maklumat kad. Turunkan sedikit.",
        warnSmall: "Palang kecil menutup kurang kawasan kad dan lebih mudah dipotong keluar. Pastikan ia masih melintasi muka dan nombor pada kad.",
        exportPng: "Muat turun PNG",
        exportPdf: "Muat turun PDF",
        working: "Sedang menyediakan fail...",
        done: "Fail sudah dimuat turun. Semak palang sebelum anda hantar.",
        failed: "Fail tidak dapat dibuat. Cuba gambar yang lebih kecil.",
        fileName: "salinan-berpalang",
        previewFront: "Pratonton depan",
        previewBack: "Pratonton belakang",
        staysHere: "Gambar kekal dalam browser ini.",
        position: "Kedudukan palang",
        positionCorner: "Sudut kiri atas",
        positionMiddle: "Tengah kad",
        cornerNote: "Palang di sudut kiri atas dijauhkan daripada bahagian tengah kad, tempat muka, nama dan nombor IC biasanya berada. Semak pratonton dan laraskan Saiz palang supaya tidak menutup butiran kad. Palang di sudut lebih mudah dipotong keluar: pilih Tengah kad jika anda mahu perlindungan yang lebih kuat.",
        cameraTitle: "Ambil gambar kad",
        cameraPreview: "Paparan kamera",
        cameraStarting: "Menghidupkan kamera...",
        cameraHint: "Letakkan kad dalam kotak putih. Pastikan kad rata, terang dan semua tepi nampak, kemudian tekan Ambil gambar.",
        cameraCapture: "Ambil gambar",
        cameraCancel: "Batal",
        cameraError: "Kamera tidak dapat dibuka. Benarkan akses kamera untuk laman ini dalam tetapan browser, atau guna aplikasi kamera telefon anda.",
        cameraFallback: "Guna aplikasi kamera telefon",
        pdfChoose: "Muat naik PDF salinan IC",
        pdfHint: "Sudah ada salinan IC dalam PDF? Pilih fail itu dan kami asingkan depan dan belakang.",
        pdfWorking: "Membaca PDF...",
        pdfSplit: "Kad depan dan belakang ditemui dan diasingkan. Semak pratonton. Jika terbalik, tekan Tukar depan dan belakang.",
        pdfOne: "Satu kad ditemui dalam PDF dan dimasukkan. Tambah sebelah lagi.",
        swap: "Tukar depan dan belakang",
        errPdf: "PDF tidak dapat dibaca. Cuba simpan semula sebagai PDF, atau guna gambar.",
        errPdfPassword: "PDF ini berkata laluan. Buka dan simpan tanpa kata laluan dahulu.",
      },
    },
    privacy: {
      title: `Privasi: ${SITE_NAME}`,
      description: "Apa yang berlaku pada gambar anda, apa yang disimpan dan apa yang tidak.",
      h1: "Privasi",
      sections: [
        { h: "Gambar anda", p: ["Gambar yang anda pilih dibaca dan dilukis dalam browser anda. Ia tidak dihantar ke pelayan kami dan kami tidak menyimpan atau melihatnya. Fail yang anda muat turun dibuat pada peranti anda.","Jika anda guna kamera, gambar diambil dalam browser anda dan tidak dihantar ke mana-mana; kamera ditutup sebaik sahaja gambar diambil. PDF yang anda pilih dibaca dalam browser anda juga."] },
        { h: "Bagaimana ini dikuatkuasakan", p: ["Halaman editor menghantar peraturan keselamatan yang menyekat sebarang sambungan rangkaian daripada halaman itu. Maknanya, walaupun ada kesilapan kod, browser tidak membenarkan halaman menghantar gambar keluar. Anda boleh periksa tab Network dalam alat pembangun browser: tiada permintaan selepas halaman dimuatkan."] },
        { h: "Apa yang disimpan", p: ["Dalam browser anda sahaja: satu penanda bahawa anda telah membaca notis privasi. Tiada kuki penjejakan. Tiada akaun.", "Penyedia hosting mungkin menyimpan log pelayan biasa (contohnya alamat IP dan masa lawatan) untuk keselamatan. Log ini tidak mengandungi gambar anda."] },
        { h: "Selepas anda muat turun", p: ["Fail itu di bawah kawalan anda. Pastikan palang jelas sebelum berkongsi, dan hanya kongsi dengan pihak yang memerlukannya. Tiada alat yang dapat menjamin salinan tidak akan disalahguna."] },
      ],
    },
    terms: {
      title: `Terma: ${SITE_NAME}`,
      description: "Syarat penggunaan alat Crossdulu.",
      h1: "Terma penggunaan",
      updated: "Kemas kini: 10 November 2026",
      sections: [
        { h: "Apa alat ini lakukan", p: ["Alat ini meletakkan teks palang pada gambar yang anda pilih, dalam browser anda. Ia disediakan percuma sebagai kemudahan, bukan nasihat undang-undang atau keselamatan."] },
        { h: "Penggunaan yang dibenarkan", p: ["Gunakan hanya dokumen anda sendiri atau dokumen yang anda berhak guna dengan kebenaran pemiliknya.", "Dilarang menggunakan alat ini untuk penipuan, penyamaran, pemalsuan atau pengubahsuaian dokumen, atau untuk menulis teks palang yang mengelirukan penerima tentang tujuan sebenar salinan."] },
        { h: "Tanggungjawab anda", p: ["Anda bertanggungjawab ke atas fail yang anda hasilkan dan kepada siapa anda menghantarnya. Kami tidak mempunyai salinan dan tidak boleh menariknya balik."] },
        { h: "Tiada jaminan", p: ["Alat ini diberikan sebagaimana adanya, tanpa jaminan bahawa ia memenuhi keperluan anda atau menghalang semua penyalahgunaan. Setakat yang dibenarkan undang-undang, kami tidak bertanggungjawab ke atas kerugian yang timbul daripada penggunaannya."] },
        { h: "Undang-undang", p: ["Terma ini tertakluk kepada undang-undang Malaysia."] },
      ],
    },
  },
  en: {
    htmlLang: "en-MY",
    nav: { editor: "Start", privacy: "Privacy", terms: "Terms", skip: "Skip to content", menu: "Menu" },
    footer: "Free tool. Your images are processed in your browser and are not sent anywhere.",
    home: {
      title: `${SITE_NAME}: cross out your ID copy in the browser, free`,
      description: "Cross out the front and back of your ID copy right in the browser. Free, no account, images are not uploaded. Save as PNG or PDF.",
      h1: "Cross out your ID copy. Free, and your images never leave your device.",
      lead: "Put a watermark across the front and back, state the purpose and date, then download a PNG or PDF. No account, no payment.",
      cta: "Start now",
      stepsTitle: "Three steps",
      steps: ["Add the front and back of the card", "Type the purpose, recipient and date", "Download as PNG or PDF"],
      whyTitle: "Why cross out an ID copy?",
      why: "An unmarked ID copy can be reused for something you never agreed to. A watermark that states the purpose and the date makes a copy much harder to misuse.",
      mkn: "Read the National Security Council advice (in Malay)",
      trustTitle: "What happens to your images",
      trust: [
        "Images are picked from your device and processed in the browser only.",
        "The page is built so it cannot send images out. You can check this yourself.",
        "No account. Close or reload the page and the images are gone.",
      ],
      faqTitle: "FAQ",
      faq: [
        { q: "Is it really free?", a: "Yes, with no limits and no account." },
        { q: "Is my ID image uploaded?", a: "No. Everything happens in your browser. See the privacy page for details." },
        { q: "Can I use my phone?", a: "Yes. Open this page in your phone browser, pick a photo or take one of the card, then download the result." },
        { q: "Other documents?", a: "Yes, for example a driving licence or a payslip. Only use documents you have the right to use." },
      ],
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
        cornerNote: "The top-left band is kept away from the middle of the card, where the face, name and ID number usually are. Check the preview and adjust Band size so it does not cover card details. A corner band is easier to crop out: choose Across the middle if you want stronger protection.",
        cameraTitle: "Take a picture of the card",
        cameraPreview: "Camera view",
        cameraStarting: "Starting the camera...",
        cameraHint: "Put the card inside the white box. Keep it flat and well lit with all four edges visible, then press Take picture.",
        cameraCapture: "Take picture",
        cameraCancel: "Cancel",
        cameraError: "The camera could not be opened. Allow camera access for this site in your browser settings, or use your phone's camera app.",
        cameraFallback: "Use the phone's camera app",
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
  },
};
