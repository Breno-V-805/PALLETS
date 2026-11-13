# PALLETS // GitHub Repository & Local Run Guide

The Git repository has been initialized with a clean initial commit (`main` branch) containing all project files, architectures, test suites, and workflows, while strictly excluding all sensitive keys and runtime state (`.secrets/`, `.data/`, `*.key`).

---

## 1. Quick Push to GitHub (2 Minutes)

### Step 1: Create an Empty GitHub Repository
1. Open [https://github.com/new](https://github.com/new) in your browser.
2. Enter a repository name (e.g. `pallets-fmcg` or `pallets-v3`).
3. Set visibility to **Public** or **Private** (both are safe; secrets are ignored by `.gitignore`).
4. **IMPORTANT**: Leave all checkboxes (**Add a README file**, **Add .gitignore**, **Choose a license**) **UNCHECKED**.
5. Click **Create repository**.
6. Copy the repository URL (e.g., `https://github.com/your-username/pallets-v3.git`).

---

### Step 2: Push Using the Helper Script or PowerShell

**Method A: Using the Automated Script**
Open PowerShell in `d:\metreecs-fmcg-dashboard` and run:
```powershell
.\push-to-github.ps1 https://github.com/<your-username>/<your-repo>.git
```

**Method B: Using Standard Git Commands**
```powershell
& "C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/<your-username>/<your-repo>.git
& "C:\Program Files\Git\bin\git.exe" push -u origin main
```

---

## 2. Running on Your Other PC (Clone & Run)

Once pushed to GitHub, you can run PALLETS on any other PC in under 1 minute with zero npm installation:

1. **Clone the repository**:
   ```powershell
   git clone https://github.com/<your-username>/<your-repo>.git
   cd <your-repo>\PALLETS-V3
   ```
2. **Start the server**:
   ```powershell
   .\start-v3.ps1
   ```
   *(Or simply run `node server.js`)*
3. **Open in browser**:
   Navigate to `http://localhost:3001`.

---

## 3. Transferring via Pendrive (No Internet Required)

If you need to transfer the repository directly with a pendrive:

1. Copy the entire `d:\metreecs-fmcg-dashboard` directory to your pendrive.
2. On your other computer, paste the folder.
3. Open PowerShell inside the folder and run:
   ```powershell
   cd PALLETS-V3
   .\start-v3.ps1
   ```
   Because PALLETS V3 has **zero external npm dependencies**, it runs immediately on any PC that has Node.js installed!

---

## 4. Free Persistent Cloud Hosting via GitHub (Optional)

If you want a free 24/7 cloud deployment without Vercel's serverless file constraints:
* **Render.com** (Free Web Service): Connect your GitHub repository, choose Node.js environment, set Start Command to `node PALLETS-V3/server.js`, and click Deploy. Render runs the full persistent Node.js server continuously.
