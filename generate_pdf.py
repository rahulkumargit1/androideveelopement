"""Generate PROJECT_DOCUMENTATION.pdf using fpdf2 (pure Python, no GTK deps)."""
import warnings
warnings.filterwarnings("ignore")
from fpdf import FPDF
import re, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PROJECT_DOCUMENTATION.pdf")

class DocPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(120,120,120)
            self.cell(0, 6, "VeriCash - Fake Currency Detection System", align="L")
            self.ln(4)
            self.set_draw_color(200,170,40)
            self.set_line_width(0.4)
            self.line(10, self.get_y(), 200, self.get_y())
            self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120,120,120)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def chapter_title(self, title, level=1):
        if level == 1:
            self.set_font("Helvetica", "B", 20)
            self.set_text_color(10, 22, 40)
            self.ln(6)
            self.multi_cell(0, 10, title)
            self.set_draw_color(201, 162, 39)
            self.set_line_width(0.8)
            self.line(10, self.get_y()+1, 130, self.get_y()+1)
            self.ln(6)
        elif level == 2:
            self.set_font("Helvetica", "B", 15)
            self.set_text_color(26, 68, 128)
            self.ln(4)
            self.multi_cell(0, 8, title)
            self.set_draw_color(220, 220, 220)
            self.set_line_width(0.3)
            self.line(10, self.get_y()+1, 200, self.get_y()+1)
            self.ln(4)
        else:
            self.set_font("Helvetica", "B", 12)
            self.set_text_color(10, 22, 40)
            self.ln(3)
            self.multi_cell(0, 7, title)
            self.ln(2)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 50)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bold_text(self, text):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(40, 40, 50)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def code_block(self, text):
        self.set_font("Courier", "", 8.5)
        self.set_fill_color(26, 26, 46)
        self.set_text_color(220, 220, 220)
        x = self.get_x()
        # Gold left border
        self.set_draw_color(201, 162, 39)
        self.set_line_width(1.2)
        lines = text.strip().split("\n")
        block_h = len(lines) * 4.5 + 8
        if self.get_y() + block_h > 270:
            self.add_page()
        start_y = self.get_y()
        self.rect(10, start_y, 190, block_h, "F")
        self.line(10, start_y, 10, start_y + block_h)
        self.set_xy(14, start_y + 4)
        for line in lines:
            self.cell(0, 4.5, line)
            self.ln(4.5)
            self.set_x(14)
        self.ln(4)
        self.set_text_color(40, 40, 50)

    def table(self, headers, rows):
        col_count = len(headers)
        col_w = 190 / col_count
        # Adjust column widths for common patterns
        if col_count == 2:
            col_w_list = [60, 130]
        elif col_count == 3:
            col_w_list = [50, 70, 70]
        elif col_count == 4:
            col_w_list = [30, 50, 60, 50]
        elif col_count == 5:
            col_w_list = [25, 35, 45, 45, 40]
        elif col_count == 6:
            col_w_list = [20, 25, 30, 35, 40, 40]
        else:
            col_w_list = [col_w] * col_count
        # Ensure total = 190
        total = sum(col_w_list)
        col_w_list = [w * 190 / total for w in col_w_list]

        # Header
        self.set_font("Helvetica", "B", 8.5)
        self.set_fill_color(26, 68, 128)
        self.set_text_color(255, 255, 255)
        for i, h in enumerate(headers):
            self.cell(col_w_list[i], 7, h.strip(), border=1, fill=True, align="L")
        self.ln()

        # Rows
        self.set_font("Helvetica", "", 8.5)
        for ri, row in enumerate(rows):
            if ri % 2 == 0:
                self.set_fill_color(248, 249, 250)
            else:
                self.set_fill_color(255, 255, 255)
            self.set_text_color(40, 40, 50)
            max_h = 7
            for i, cell_val in enumerate(row):
                val = cell_val.strip() if i < len(row) else ""
                # Clean markdown formatting
                val = re.sub(r'\*\*(.*?)\*\*', r'\1', val)
                val = re.sub(r'`(.*?)`', r'\1', val)
                self.cell(col_w_list[i] if i < len(col_w_list) else col_w, 7, val[:50], border=1, fill=True, align="L")
            self.ln()
        self.ln(3)

    def bullet(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 50)
        x = self.get_x()
        self.set_x(x + 4)
        self.set_font("Helvetica", "B", 10)
        self.cell(5, 5.5, "-")
        self.set_font("Helvetica", "", 10)
        # Clean bold markers
        clean = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        clean = re.sub(r'`(.*?)`', r'\1', clean)
        self.multi_cell(0, 5.5, clean)
        self.ln(1)

def clean(t):
    t = re.sub(r'\*\*(.*?)\*\*', r'\1', t)
    t = re.sub(r'`(.*?)`', r'\1', t)
    t = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', t)
    return t.strip()

# ── Build PDF ──────────────────────────────────────────────────────────
pdf = DocPDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)

# ── Cover page ─────────────────────────────────────────────────────────
pdf.add_page()
pdf.ln(40)
pdf.set_font("Helvetica", "B", 36)
pdf.set_text_color(10, 22, 40)
pdf.cell(0, 15, "VeriCash", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 14)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 8, "Fake Currency Detection System", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)
pdf.set_draw_color(201, 162, 39)
pdf.set_line_width(1.5)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.ln(10)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(60, 60, 60)
pdf.cell(0, 7, "Complete Project Documentation", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 7, "Version 1.0.0  |  Heuristic v4 (ML-Anchored)", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 7, "April 2026", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(20)
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(80, 80, 80)
info = [
    "Platform: Web + Android APK + REST API",
    "Backend: FastAPI + OpenCV + TensorFlow Lite",
    "Frontend: Next.js 14 (TypeScript)",
    "Mobile: Expo React Native",
    "Infrastructure: AWS EC2 + Caddy + GitHub Actions",
    "",
    "Live: https://vericash.duckdns.org",
    "Repository: github.com/rahulkumargit1/androideveelopement",
]
for line in info:
    pdf.cell(0, 6, line, align="C", new_x="LMARGIN", new_y="NEXT")

# ── Table of Contents ──────────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("Table of Contents", 1)
toc = [
    "1. Project Overview",
    "2. System Architecture",
    "3. Technology Stack",
    "4. Installation Guide (Setup on Any PC)",
    "5. Detection Pipeline - 7 PBL Techniques",
    "6. Ensemble Scoring (v4)",
    "7. API Reference",
    "8. User Roles & Authentication",
    "9. Deployment (AWS EC2)",
    "10. Mobile App (Android APK)",
    "11. File Structure",
    "12. Troubleshooting",
]
for item in toc:
    pdf.body_text(item)

# ── 1. Project Overview ───────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("1. Project Overview", 1)
pdf.body_text(
    "VeriCash is a counterfeit currency detection system that uses 7 image-processing techniques "
    "(Problem-Based Learning approach) to analyse banknote photographs and issue an authenticity "
    "verdict: authentic, suspicious, or counterfeit."
)
pdf.chapter_title("Key Features", 3)
features = [
    "Multi-currency support: INR, USD, EUR (with TFLite ML models)",
    "7-technique pipeline: Image enhancement, histogram, spatial, FFT, noise, morphology, colour-space",
    "ML-anchored scoring (v4): TensorFlow Lite provides primary confidence, validated by heuristics",
    "Web interface: Responsive Next.js app with government-inspired design",
    "Android APK: Native Expo React Native app with camera scanning",
    "REST API: FastAPI backend serving both web and mobile",
    "Role-based access: Admin, Inspector, Viewer roles",
    "Batch scanning: Scan up to 10 notes at once",
    "Scan history & analytics: Donut charts, trend bars, CSV export",
]
for f in features:
    pdf.bullet(f)

pdf.chapter_title("Live URLs", 3)
pdf.table(
    ["Resource", "URL"],
    [
        ["Web App", "https://vericash.duckdns.org"],
        ["API Docs", "https://vericash.duckdns.org/api/docs"],
        ["System Status", "https://vericash.duckdns.org/status"],
        ["APK Download", "github.com/.../releases/latest/download/VeriCash.apk"],
    ]
)

# ── 2. System Architecture ────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("2. System Architecture", 1)
pdf.body_text(
    "The system follows a three-tier architecture: frontend clients (Web + Mobile) communicate "
    "with a FastAPI backend over HTTPS. The backend runs the OpenCV computer vision pipeline and "
    "TFLite ML models, storing results in a SQLite database."
)
pdf.chapter_title("Data Flow (Scan Request)", 3)
steps = [
    "1. User captures/uploads a banknote image",
    "2. Frontend compresses to 800px max, sends to /api/scan",
    "3. Backend runs the 7-technique pipeline (pre-processing, classification, scoring)",
    "4. Ensemble v4 computes weighted average of 8 subscores",
    "5. Returns verdict with confidence, breakdown, and subscores",
    "6. Result displayed with colour-coded verdict band",
]
for s in steps:
    pdf.body_text(s)

# ── 3. Technology Stack ───────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("3. Technology Stack", 1)
pdf.chapter_title("Backend", 3)
pdf.table(
    ["Component", "Technology", "Version"],
    [
        ["Framework", "FastAPI", "0.111+"],
        ["Language", "Python", "3.11"],
        ["Image Processing", "OpenCV (cv2)", "4.x"],
        ["ML Inference", "TensorFlow Lite", "2.x"],
        ["OCR", "EasyOCR", "1.x"],
        ["Database", "SQLite + SQLAlchemy", "-"],
        ["Server", "Uvicorn", "-"],
    ]
)
pdf.chapter_title("Web Frontend", 3)
pdf.table(
    ["Component", "Technology", "Version"],
    [
        ["Framework", "Next.js", "14.2"],
        ["Language", "TypeScript", "5.3"],
        ["Styling", "CSS (custom design system)", "-"],
        ["Icons", "Lucide React", "-"],
    ]
)
pdf.chapter_title("Mobile App", 3)
pdf.table(
    ["Component", "Technology", "Version"],
    [
        ["Framework", "Expo (React Native)", "SDK 51"],
        ["Camera", "expo-camera", "15.x"],
        ["Build", "EAS Build / Gradle", "-"],
    ]
)
pdf.chapter_title("Infrastructure", 3)
pdf.table(
    ["Component", "Technology"],
    [
        ["Server", "AWS EC2 (t2.micro, Ubuntu)"],
        ["Reverse Proxy", "Caddy (auto HTTPS)"],
        ["DNS", "DuckDNS (vericash.duckdns.org)"],
        ["CI/CD", "GitHub Actions (4 workflows)"],
    ]
)

# ── 4. Installation Guide ─────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("4. Installation Guide", 1)
pdf.body_text("Follow these steps to set up VeriCash on any Windows/macOS/Linux PC.")
pdf.chapter_title("Prerequisites", 3)
pdf.bullet("Python 3.11+ (with pip)")
pdf.bullet("Node.js 20+ (with npm)")
pdf.bullet("Git")

pdf.chapter_title("Step 1: Clone the Repository", 3)
pdf.code_block("git clone https://github.com/rahulkumargit1/androideveelopement.git\ncd androideveelopement")

pdf.chapter_title("Step 2: Backend Setup", 3)
pdf.code_block(
    "cd backend\n"
    "python -m venv .venv\n\n"
    "# Activate (Windows):\n"
    ".venv\\Scripts\\activate\n\n"
    "# Activate (macOS/Linux):\n"
    "source .venv/bin/activate\n\n"
    "# Install dependencies:\n"
    "pip install -r requirements.txt\n\n"
    "# Start backend server:\n"
    "uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"
)
pdf.body_text("Backend available at: http://localhost:8001")
pdf.body_text("API docs at: http://localhost:8001/docs")

pdf.chapter_title("Step 3: Web Frontend Setup", 3)
pdf.code_block(
    "cd web\n"
    "npm install --legacy-peer-deps\n\n"
    "# Create env config:\n"
    'echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local\n\n'
    "# Start dev server:\n"
    "npm run dev"
)
pdf.body_text("Web app available at: http://localhost:3000")

pdf.chapter_title("Step 4: First-Time Login", 3)
pdf.body_text("1. Open http://localhost:3000 in your browser")
pdf.body_text("2. Go to Settings page")
pdf.body_text("3. Default admin credentials:")
pdf.table(["Email", "Password", "Role"], [["admin@vericash.gov", "admin", "Admin"]])

pdf.chapter_title("Step 5: Run Tests", 3)
pdf.code_block("cd backend\npython -m pytest tests/ -v")
pdf.body_text("Expected: 7 tests passed.")

# ── 5. Detection Pipeline ─────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("5. Detection Pipeline - 7 PBL Techniques", 1)
pdf.table(
    ["#", "Technique", "Module", "What It Detects"],
    [
        ["1", "Image Enhancement", "enhance.py", "Exposure quality"],
        ["2", "Histogram Processing", "histogram.py", "Intensity distribution + channel diversity"],
        ["3", "Spatial Filtering", "spatial.py", "Fine print detail (Laplacian)"],
        ["4", "Frequency-Domain (FFT)", "frequency.py", "Micro-print energy"],
        ["5", "Noise Removal", "noise.py", "Paper-grain noise + moire"],
        ["6", "Morphological Ops", "morphology.py", "Security thread continuity"],
        ["7", "Colour-Space (CIE Lab)", "colorspace.py", "Lab colour fingerprint matching"],
    ]
)

# ── 6. Ensemble Scoring ───────────────────────────────────────────────
pdf.chapter_title("6. Ensemble Scoring (v4)", 1)
pdf.table(
    ["Signal", "Weight", "Description"],
    [
        ["ml_confidence", "32%", "TFLite MobileNet classification"],
        ["profile_match", "26%", "CIE Lab distance to genuine profile"],
        ["color_consistency", "14%", "Chroma within expected range"],
        ["texture_detail", "8%", "Laplacian variance"],
        ["noise_consistency", "6%", "Paper-grain noise + moire"],
        ["microprint_presence", "4%", "FFT high-frequency energy"],
        ["thread_detection", "4%", "Security thread morphology"],
        ["histogram_profile", "4%", "Multi-modal histogram"],
        ["exposure_valid", "2%", "Quality gate"],
    ]
)
pdf.body_text(
    "ML Anchoring: When TFLite confidence >= 0.40, it anchors the result at 60% weight. "
    "Colour-Mismatch Penalty: If profile_match < 0.30, penalty of up to -0.15 applied."
)
pdf.chapter_title("Verdict Thresholds", 3)
pdf.table(
    ["Score Range", "Verdict"],
    [
        [">= 0.78", "Authentic"],
        ["0.45 - 0.77", "Suspicious"],
        ["< 0.45", "Counterfeit"],
    ]
)

# ── 7. API Reference ──────────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("7. API Reference", 1)
pdf.body_text("Base URL (local): http://localhost:8001")
pdf.body_text("Base URL (production): https://vericash.duckdns.org")
pdf.body_text("Swagger UI: /docs")
pdf.table(
    ["Method", "Endpoint", "Description", "Auth"],
    [
        ["POST", "/api/scan", "Scan single banknote", "Required"],
        ["POST", "/api/scan/batch", "Scan multiple (up to 10)", "Required"],
        ["GET", "/api/history", "Get scan history", "Required"],
        ["GET", "/api/stats", "Get analytics", "Required"],
        ["DELETE", "/api/history", "Clear history", "Admin/Inspector"],
        ["GET", "/health", "Health check", "Public"],
        ["POST", "/api/auth/login", "Login", "Public"],
        ["POST", "/api/auth/logout", "Logout", "Required"],
        ["GET", "/api/auth/me", "Current user info", "Required"],
        ["GET", "/api/currencies", "Supported currencies", "Public"],
        ["GET", "/api/members", "List team members", "Public"],
        ["PUT", "/api/members", "Add/update member", "Admin"],
        ["DELETE", "/api/members/:id", "Remove member", "Admin"],
    ]
)

# ── 8. User Roles ─────────────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("8. User Roles & Authentication", 1)
pdf.table(
    ["Role", "Scan", "History", "Manage Members", "Settings"],
    [
        ["Admin", "Yes", "All scans", "Yes", "Yes"],
        ["Inspector", "Yes", "Own scans", "No", "No"],
        ["Viewer", "No", "All (read-only)", "No", "No"],
        ["Anonymous", "No", "No", "View only", "No"],
    ]
)

# ── 9. Deployment ─────────────────────────────────────────────────────
pdf.chapter_title("9. Deployment (AWS EC2)", 1)
pdf.body_text("Instance: t2.micro (Ubuntu 22.04)")
pdf.body_text("Services: vericash (backend) + vericash-web (frontend) as systemd units")
pdf.body_text("Reverse proxy: Caddy with automatic HTTPS")
pdf.body_text("DNS: DuckDNS -> vericash.duckdns.org")
pdf.chapter_title("CI/CD Workflows", 3)
pdf.table(
    ["Workflow", "Trigger", "Action"],
    [
        ["deploy-ec2.yml", "Push to main", "SSH, pull, rebuild, restart"],
        ["build-android.yml", "Push to main", "Build APK, publish release"],
        ["backend-ci.yml", "Push to main", "Run pytest"],
        ["web-ci.yml", "Push to main", "Run Next.js build"],
    ]
)

# ── 10. Mobile App ────────────────────────────────────────────────────
pdf.chapter_title("10. Mobile App (Android APK)", 1)
pdf.chapter_title("Install from Release", 3)
pdf.body_text("1. Download APK: github.com/rahulkumargit1/androideveelopement/releases/latest")
pdf.body_text('2. Enable "Install unknown apps" in Android Settings')
pdf.body_text("3. Open downloaded APK and install")
pdf.body_text("4. Launch VeriCash > Settings > set server URL")
pdf.body_text("5. Sign in with your credentials")

pdf.chapter_title("Build from Source", 3)
pdf.code_block(
    "cd mobile\n"
    "npm install --legacy-peer-deps\n"
    "npx expo prebuild --platform android --non-interactive --clean\n"
    "cd android\n"
    "./gradlew assembleRelease\n\n"
    "# APK at: android/app/build/outputs/apk/release/app-release.apk"
)

# ── 11. File Structure ────────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("11. File Structure", 1)
pdf.code_block(
    "FAKECURRENCYDETECTION/\n"
    "  backend/\n"
    "    app/\n"
    "      main.py            # FastAPI entry point\n"
    "      config.py          # Configuration\n"
    "      cv_pipeline/\n"
    "        pipeline.py      # Main analysis\n"
    "        ensemble.py      # v4 weighted scoring\n"
    "        classifier.py    # TFLite + Lab classification\n"
    "        colorspace.py    # CIE Lab matching\n"
    "        enhance.py       # Image enhancement\n"
    "        histogram.py     # Histogram analysis\n"
    "        spatial.py       # Spatial filtering\n"
    "        frequency.py     # FFT analysis\n"
    "        noise.py         # Noise analysis\n"
    "        morphology.py    # Security thread detection\n"
    "        models/          # TFLite model files\n"
    "      routes/            # API route handlers\n"
    "      database/          # SQLAlchemy models\n"
    "    tests/\n"
    "    requirements.txt\n"
    "  web/\n"
    "    app/\n"
    "      page.tsx           # Scan page\n"
    "      layout.tsx         # App shell\n"
    "      globals.css        # Design system\n"
    "      history/           # Scan history + analytics\n"
    "      members/           # Team administration\n"
    "      settings/          # Auth + app settings\n"
    "      status/            # System health dashboard\n"
    "    components/\n"
    "      Nav.tsx, ScanCamera.tsx, ResultCard.tsx\n"
    "  mobile/\n"
    "    app/                 # Expo Router screens\n"
    "    app.json             # Expo config\n"
    "  .github/workflows/\n"
    "    deploy-ec2.yml       # Auto-deploy to EC2\n"
    "    build-android.yml    # Build + publish APK"
)

# ── 12. Troubleshooting ───────────────────────────────────────────────
pdf.add_page()
pdf.chapter_title("12. Troubleshooting", 1)
pdf.table(
    ["Problem", "Solution"],
    [
        ["Cannot connect to backend", "Ensure backend on port 8001, check .env.local"],
        ["Scan failed", "Valid JPEG/PNG? TFLite models in models/?"],
        ["Module not found", "pip install -r requirements.txt"],
        ["npm install fails", "Use --legacy-peer-deps flag"],
        ["APK won't install", 'Enable "Install unknown apps" in Android'],
        ["Cached old version", "Hard-refresh: Ctrl+Shift+R"],
    ]
)
pdf.chapter_title("Port Configuration", 3)
pdf.table(
    ["Service", "Port"],
    [
        ["Backend API", "8001"],
        ["Web Frontend", "3000"],
        ["Caddy (HTTPS)", "443 -> 8001/3000"],
    ]
)
pdf.chapter_title("Log Files (EC2)", 3)
pdf.code_block(
    "# Backend logs:\n"
    "sudo journalctl -u vericash -f\n\n"
    "# Web frontend logs:\n"
    "sudo journalctl -u vericash-web -f\n\n"
    "# Caddy logs:\n"
    "sudo journalctl -u caddy -f"
)

# ── Save ──────────────────────────────────────────────────────────────
pdf.output(OUT)
print(f"PDF generated: {OUT}")
