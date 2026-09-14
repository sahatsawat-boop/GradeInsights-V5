// Global Error Handler
    window.onerror = function(message, source, lineno, colno, error) {
      const errorMsg = 'JavaScript Error: ' + message + ' (at ' + source + ':' + lineno + ':' + colno + ')';
      console.error(errorMsg);
      
      const notice = document.getElementById("no-data-notice");
      if (notice) {
        notice.classList.remove("d-none");
        notice.style.background = "rgba(239, 68, 68, 0.1)";
        notice.style.border = "1px dashed rgba(239, 68, 68, 0.4)";
        notice.innerHTML = `
          <p style="margin-bottom: 10px; font-weight: 600; color: var(--danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; margin-right: 5px;"></i> เกิดข้อผิดพลาดของระบบ:</p>
          <div style="text-align: left; font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; overflow-x: auto; color: var(--text-main); max-height: 120px; margin-bottom: 10px;">
            ${message}<br>
            Line: ${lineno}<br>
            Source: ${source ? source.split('/').pop() : 'unknown'}
          </div>
          <button type="button" class="role-btn btn-secondary" onclick="loadLocalFallback()" style="width: 100%; font-size: 12px; padding: 8px;"><i class="fa-solid fa-plug"></i> เปลี่ยนไปทำงานในโหมดทดลองออฟไลน์ (Local Mode)</button>
        `;
      }
      return false; 
    };

    // Safe Storage implementation (prevent sandboxing local storage bugs)
    const SafeStorage = {
      cache: {},
      isSupported: function() {
        try {
          localStorage.setItem("__test__", "1");
          localStorage.removeItem("__test__");
          return true;
        } catch (e) {
          return false;
        }
      },
      getItem: function(key) {
        if (this.isSupported()) return localStorage.getItem(key);
        return this.cache[key] || null;
      },
      setItem: function(key, val) {
        if (this.isSupported()) localStorage.setItem(key, val);
        else this.cache[key] = val;
      },
      removeItem: function(key) {
        if (this.isSupported()) localStorage.removeItem(key);
        else delete this.cache[key];
      }
    };

    // REST API Configuration for GitHub Pages hosting
    const DEFAULT_BACKEND_URL = "https://script.google.com/macros/s/AKfycbxjYdoV54aJNOFaJrZRvrtQdSQqgwSTZzE9unX58iS32co9ybGozHpy5Q5tMR6IrbAS/exec"; // ลิงก์ Web App API ของคุณครู
    
    function getBackendURL() {
      return SafeStorage.getItem("backend_web_app_url") || DEFAULT_BACKEND_URL;
    }

    function formatConfigSheet() {
      showToast("⚙️ กำลังจัดระเบียบชีต Config...", "info");
      callBackendAPI("formatConfig")
        .then(res => {
          showToast("✅ จัดระเบียบและตกแต่งชีต Config ใน Google Sheets เรียบร้อยแล้ว!", "success");
        })
        .catch(err => {
          showToast("❌ การเชื่อมต่อล้มเหลว: " + err.message, "danger");
        });
    }

    function setupAllSheetsFormulas() {
      showToast("⏳ กำลังติดตั้งสูตรคะแนนรวมและเกรดใน Google Sheets ทุกแผ่นงาน...", "info");
      callBackendAPI("setupAllSheetsFormulas")
        .then(res => {
          if (res && res.status === "success") {
            showToast("⚡ " + (res.message || "ติดตั้งสูตรคะแนนรวมและเกรดสำเร็จครบทุกชีต!"), "success");
            if (typeof syncTeacherGrades === "function") syncTeacherGrades();
          } else {
            showToast("⚠️ " + (res.message || "ไม่สามารถติดตั้งสูตรได้"), "danger");
          }
        })
        .catch(err => {
          showToast("❌ การเชื่อมต่อล้มเหลว: " + err.message, "danger");
        });
    }

    function saveConnectionSettings() {
      const urlInput = document.getElementById("settings-web-app-url");
      if (urlInput) {
        const url = urlInput.value.trim();
        SafeStorage.setItem("backend_web_app_url", url);
        showToast("💾 บันทึก Web App URL เรียบร้อยแล้ว!", "success");
        
        // ถ้าอยู่ในโหมดออฟไลน์ ให้ซิงค์ข้อมูลใหม่ทันที
        if (!isGAS) {
          syncTeacherGrades();
        }
      }
    }

    async function callBackendAPI(action, params = {}) {
      const url = getBackendURL();
      
      // แนบรหัสผ่าน PIN สำหรับคำสั่งที่จำเป็นต้องใช้สิทธิ์ครูอัตโนมัติ
      if (action !== "getInitData" && action !== "searchStudent" && action !== "verifyTeacherPIN") {
        params.pin = sessionStorage.getItem("teacher_session_pin") || "";
      }
      
      if (isGAS) {
        return new Promise((resolve, reject) => {
          var runner = google.script.run
            .withSuccessHandler(res => resolve(res))
            .withFailureHandler(err => reject(err));
          
          if (action === "getInitData") runner.getInitData();
          else if (action === "verifyTeacherPIN") runner.verifyTeacherPINAPI(params.pin);
          else if (action === "formatConfig") runner.formatConfigSheetAPI();
          else if (action === "setupAllSheetsFormulas") runner.setupAllSheetsFormulasAPI();
          else if (action === "fetchAllGrades") runner.fetchAllGradesAcrossSheetsAPI(params.pin);
          else if (action === "searchStudent") runner.searchStudentAcrossSheetsAPI(params.studentId, params.classroom);
          else if (action === "fetchGradesData") runner.fetchGradesData(params.sheetName, params.pin);
          else if (action === "updateScores") runner.updateScoresAPI(params.sheetName, params.studentId, params.subjectCode, params.scores, params.pin);
          else if (action === "addColumn") runner.addColumnAPI(params.sheetName, params.columnName, params.pin);
          else if (action === "deleteColumn") runner.deleteColumnAPI(params.sheetName, params.columnName, params.pin);
          else if (action === "renameColumn") runner.renameColumnAPI(params.sheetName, params.oldColumnName, params.newColumnName, params.pin);
          else if (action === "deleteStudent") runner.deleteStudentAPI(params.sheetName, params.studentId, params.subjectCode, params.pin);
          else if (action === "addStudent") runner.addStudentAPI(params.sheetName, params.studentData, params.pin);
          else if (action === "addStudentsBulk") runner.addStudentsBulkAPI(params.studentsList, params.pin);
          else if (action === "createSampleData") runner.createSampleDataAPI(params.pin);
          else if (action === "saveCustomSubjectName") runner.saveCustomSubjectNameAPI(params.sheetName, params.customName, params.pin);
          else if (action === "saveSummaryReport") runner.saveSummaryReportAPI(JSON.parse(params.reportData), params.pin);
          else reject(new Error("Unknown action: " + action));
        });
      } else {
        // Run outside GAS environment (REST API calls)
        if (!url) {
          throw new Error("ยังไม่ได้กำหนดค่า Web App URL ในหน้าตั้งค่า");
        }
        
        // GET requests (Query Params)
        if (["getInitData", "fetchAllGrades", "searchStudent", "fetchGradesData", "verifyTeacherPIN"].includes(action)) {
          var queryParams = new URLSearchParams({ action: action, ...params }).toString();
          var fetchUrl = `${url}?${queryParams}&ts=${Date.now()}`;
          var response = await fetch(fetchUrl);
          if (!response.ok) throw new Error("การเชื่อมต่อระบบล้มเหลว สถานะ: " + response.status);
          return await response.json();
        } 
        // POST requests
        else {
          var payload = { action: action, ...params };
          // We use no-cors to bypass CORS errors. The Google Sheet will receive the request and update,
          // but we won't be able to inspect the response.
          await fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          // Since no-cors hides the response, we simulate success
          return { status: "success" };
        }
      }
    }

    // -------------------------------------------------------------
    // DEFAULT MOCK DATA
    // -------------------------------------------------------------
    const DEFAULT_HEADERS = ["student_id", "name", "classroom", "student_no", "subject_code", "subject_name", "midterm_score", "final_score", "ใบงาน 1 (10)", "จิตพิสัย (10)", "โครงงาน (20)", "comment"];
    const DEFAULT_MOCK_DATA = [
      {
        student_id: "69001", name: "นายสมชาย ใจดี", classroom: "ม.4/1", student_no: 1, subject_code: "ค31201", subject_name: "คณิตศาสตร์เพิ่มเติม",
        midterm_score: 18, final_score: 17, "ใบงาน 1 (10)": 9, "จิตพิสัย (10)": 9, "โครงงาน (20)": 18, comment: "ตั้งใจเรียนดีมาก คอยช่วยเหลือเพื่อนสะกดแนวคิดทางคณิตศาสตร์"
      },
      {
        student_id: "69002", name: "นางสาวสมศรี สวยงาม", classroom: "ม.4/1", student_no: 2, subject_code: "ค31201", subject_name: "คณิตศาสตร์เพิ่มเติม",
        midterm_score: 12, final_score: 11, "ใบงาน 1 (10)": 8, "จิตพิสัย (10)": 7, "โครงงาน (20)": 14, comment: "เกณฑ์ปานกลาง ควรทบทวนสูตรเพิ่มเติมและส่งงานให้ตรงเวลาขึ้น"
      },
      {
        student_id: "69003", name: "นายสมศักดิ์ รักดี", classroom: "ม.4/1", student_no: 3, subject_code: "ค31201", subject_name: "คณิตศาสตร์เพิ่มเติม",
        midterm_score: 8, final_score: 9, "ใบงาน 1 (10)": 5, "จิตพิสัย (10)": 4, "โครงงาน (20)": 10, comment: "กลุ่มเสี่ยงวิกฤต! ขาดเรียนบ่อยครั้งและคะแนนเก็บต่ำกว่าเกณฑ์"
      },
      {
        student_id: "68001", name: "นายเจษฎา ศรีสุข", classroom: "ม.5/1", student_no: 1, subject_code: "ว31281", subject_name: "คอมพิวเตอร์กราฟิก",
        midterm_score: 17, final_score: 16, "ใบงาน 1 (10)": 9, "จิตพิสัย (10)": 8, "โครงงาน (20)": 18, comment: "มีความคิดสร้างสรรค์ในงานออกแบบดีเยี่ยม"
      }
    ];

    // State Variables
    let activeSection = "student-search-sec";
    let activeTheme = "ocean";
    let isDarkMode = false;
    let isTeacherLoggedIn = false;
    let dbTeacherPin = "1234";
    let activeAlertTab = "red";
    
    // Core Databases
    let dbHeaders = [];
    let dbGrades = [];
    let dbSheetNames = ["ม.4/1_คณิตศาสตร์", "ม.5/1_คอมพิวเตอร์"];
    let dbClassrooms = ["ม.4/1", "ม.5/1"];
    let activeSheetName = "ม.4/1_คณิตศาสตร์";
    
    // Chart references
    let studentBarChartInstance = null;
    let studentRadarChartInstance = null;
    let teacherBarChartInstance = null;
    let teacherPieChartInstance = null;

    // Checks environment
    const isGAS = typeof google !== "undefined" && google && google.script && google.script.run;

    if (document.readyState === "complete" || document.readyState === "interactive") {
      initApp();
    } else {
      window.addEventListener("DOMContentLoaded", initApp);
    }

    /* =============================================================
       MAGIC UI JAVASCRIPT SYSTEM
       ============================================================= */
    function initMagicUI() {
      // 1. Check saved animations preference (Default is enabled)
      const savedAnim = SafeStorage.getItem("magic_animations_enabled");
      const toggleBtn = document.getElementById("magic-toggle-btn");
      if (savedAnim === "0") {
        document.body.classList.add("animations-off");
        if (toggleBtn) {
          toggleBtn.classList.remove("active");
          toggleBtn.title = "เปิดเอฟเฟกต์ Magic UI";
        }
      } else {
        document.body.classList.remove("animations-off");
        if (toggleBtn) {
          toggleBtn.classList.add("active");
          toggleBtn.title = "ปิดเอฟเฟกต์ Magic UI";
        }
      }

      // 2. Setup Magic Card Spotlight cursor tracking
      document.addEventListener("mousemove", e => {
        if (document.body.classList.contains("animations-off")) return;
        const cards = document.querySelectorAll(".magic-card");
        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          if (
            e.clientX >= rect.left - 60 &&
            e.clientX <= rect.right + 60 &&
            e.clientY >= rect.top - 60 &&
            e.clientY <= rect.bottom + 60
          ) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
          }
        });
      }, { passive: true });
    }

    function toggleMagicAnimations() {
      const isCurrentlyOff = document.body.classList.toggle("animations-off");
      const toggleBtn = document.getElementById("magic-toggle-btn");
      if (isCurrentlyOff) {
        SafeStorage.setItem("magic_animations_enabled", "0");
        if (toggleBtn) {
          toggleBtn.classList.remove("active");
          toggleBtn.title = "เปิดเอฟเฟกต์ Magic UI";
        }
        showToast("🪄 ปิดเอฟเฟกต์ Magic UI แล้ว (โหมดประหยัดพลังงาน)", "info");
      } else {
        SafeStorage.setItem("magic_animations_enabled", "1");
        if (toggleBtn) {
          toggleBtn.classList.add("active");
          toggleBtn.title = "ปิดเอฟเฟกต์ Magic UI";
        }
        showToast("✨ เปิดเอฟเฟกต์ Magic UI แล้ว", "success");
        triggerMagicConfetti();
      }
    }

    function triggerMagicConfetti() {
      if (document.body.classList.contains("animations-off")) return;
      const canvas = document.getElementById("magic-confetti-canvas");
      if (!canvas) return;

      canvas.style.display = "block";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d");

      // Extract theme colors
      const bodyStyle = getComputedStyle(document.body);
      const primaryCol = bodyStyle.getPropertyValue("--primary").trim() || "#3b82f6";
      const accentCol = bodyStyle.getPropertyValue("--accent").trim() || "#06b6d4";
      const colors = [primaryCol, accentCol, "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#f43f5e"];

      const particleCount = 130;
      const particles = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: canvas.width * (0.35 + Math.random() * 0.3),
          y: canvas.height * 0.55,
          vx: (Math.random() - 0.5) * 20,
          vy: -Math.random() * 18 - 6,
          size: Math.random() * 8 + 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 12,
          gravity: 0.42,
          drag: 0.98,
          opacity: 1,
          shape: Math.random() > 0.4 ? "rect" : "circle"
        });
      }

      let startTime = Date.now();
      let animFrameId = null;

      function renderFrame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const elapsed = Date.now() - startTime;
        let alive = 0;

        particles.forEach(p => {
          p.vx *= p.drag;
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.rotSpeed;

          if (elapsed > 1800) {
            p.opacity -= 0.025;
          }

          if (p.opacity > 0 && p.y < canvas.height + 60) {
            alive++;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.opacity);

            if (p.shape === "circle") {
              ctx.beginPath();
              ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
            }

            ctx.restore();
          }
        });

        if (alive > 0 && elapsed < 3500) {
          animFrameId = requestAnimationFrame(renderFrame);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.style.display = "none";
          if (animFrameId) cancelAnimationFrame(animFrameId);
        }
      }

      renderFrame();
    }

    window.addEventListener("resize", () => {
      const canvas = document.getElementById("magic-confetti-canvas");
      if (canvas && canvas.style.display !== "none") {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });

    function initApp() {
      // Set global Chart.js font
      if (typeof Chart !== "undefined") {
        Chart.defaults.font.family = "'Sarabun', 'TH Sarabun New', 'TH Sarabun PSK', sans-serif";
      }
      // Load Theme & Dark mode
      const savedTheme = SafeStorage.getItem("app_theme") || "ocean";
      const savedDarkMode = SafeStorage.getItem("app_dark_mode") === "true";
      setTheme(savedTheme);
      if (savedDarkMode) {
        document.body.classList.add("dark-mode");
        isDarkMode = true;
        document.getElementById("theme-toggle-btn").innerHTML = '<i class="fa-solid fa-sun"></i>';
      }
      initMagicUI();

      // Populate settings Web App URL input
      const urlInput = document.getElementById("settings-web-app-url");
      if (urlInput) {
        urlInput.value = getBackendURL();
      }

      // Load initial config from database
      if (isGAS || getBackendURL()) {
        if (!isGAS) {
          showToast("🔗 กำลังเชื่อมต่อฐานข้อมูล Google Sheets...", "info");
        }
        callBackendAPI("getInitData")
          .then(res => {
            if (res && res.status === "success") {
              dbSheetNames = res.sheetNames || [];
              dbClassrooms = res.classrooms || [];
              
              const notice = document.getElementById("no-data-notice");
              if (dbClassrooms.length === 0) {
                if (notice) notice.classList.remove("d-none");
              } else {
                if (notice) notice.classList.add("d-none");
              }
              
              // Setup Search Dropdown
              const select = document.getElementById("search-classroom");
              select.innerHTML = '<option value="" disabled selected>-- เลือกห้องเรียน --</option>';
              dbClassrooms.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = c;
                select.appendChild(opt);
              });
              if (!isGAS) {
                showToast("✅ เชื่อมต่อฐานข้อมูลสำเร็จ", "success");
              }
              
              // Auto log in if session exists and PIN is present
              if (SafeStorage.getItem("is_teacher_logged_in") === "true" && sessionStorage.getItem("teacher_session_pin")) {
                enterTeacherMode(true);
              } else {
                exitTeacherMode();
              }
            } else {
              showToast("⚠️ ไม่สามารถโหลดข้อมูลเริ่มต้นได้ ใช้โหมดออฟไลน์แทน", "warning");
              loadLocalFallback();
            }
          })
          .catch(err => {
            showToast("⚠️ การเชื่อมต่อฐานข้อมูลล้มเหลว: " + err.message, "danger");
            loadLocalFallback();
          });
      } else {
        loadLocalFallback();
      }
    }

    function loadLocalFallback() {
      // Local setup fallback
      const notice = document.getElementById("no-data-notice");
      if (notice) notice.classList.add("d-none");

      const cachedHeaders = SafeStorage.getItem("db_headers");
      const cachedGrades = SafeStorage.getItem("db_grades");
      const cachedSheetNames = SafeStorage.getItem("db_sheet_names");
      
      dbHeaders = cachedHeaders ? JSON.parse(cachedHeaders) : DEFAULT_HEADERS;
      dbGrades = cachedGrades ? JSON.parse(cachedGrades) : DEFAULT_MOCK_DATA;
      dbSheetNames = cachedSheetNames ? JSON.parse(cachedSheetNames) : ["ม.4/1_คณิตศาสตร์", "ม.5/1_คอมพิวเตอร์"];
      dbAllHeaders = DEFAULT_HEADERS;
      
      dbSheetNames.forEach(sheet => {
        dbSheetHeadersMap[sheet] = DEFAULT_HEADERS;
      });
      
      rebuildLocalDropdowns();
      showToast("ℹ️ ทำงานในโหมดทดสอบแบบออฟไลน์ (Local Mode)", "info");
      
      // Auto log in if session exists and PIN is present
      if (SafeStorage.getItem("is_teacher_logged_in") === "true" && sessionStorage.getItem("teacher_session_pin")) {
        enterTeacherMode(true);
      } else {
        exitTeacherMode();
      }
    }

    function generateSampleData() {
      const notice = document.getElementById("no-data-notice");
      showToast("⚙️ กำลังสร้างข้อมูลตัวอย่างลงใน Google Sheets...", "info");
      
      if (isGAS || getBackendURL()) {
        callBackendAPI("createSampleData")
          .then(res => {
            if (res && res.status === "success") {
              showToast("✅ สร้างข้อมูลตัวอย่างสำเร็จ!", "success");
              if (notice) notice.classList.add("d-none");
              initApp(); // รีโหลดแอปเพื่อดึงข้อมูลล่าสุด
            } else {
              showToast("❌ เกิดข้อผิดพลาด: " + (res ? res.message : "ไม่สามารถระบุได้"), "danger");
            }
          })
          .catch(err => {
            showToast("❌ การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว: " + err.message, "danger");
          });
      } else {
        showToast("ℹ️ ทำงานในโหมดออฟไลน์ มีข้อมูลจำลองพร้อมทดสอบอยู่แล้ว", "info");
      }
    }

    function rebuildLocalDropdowns() {
      // Unique Classrooms
      const rooms = [...new Set(dbGrades.map(g => g.classroom))].sort();
      dbClassrooms = rooms.length > 0 ? rooms : ["ม.4/1", "ม.5/1"];
      
      // Setup Search Dropdown
      const select = document.getElementById("search-classroom");
      select.innerHTML = '<option value="" disabled selected>-- เลือกห้องเรียน --</option>';
      dbClassrooms.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
    }

    let dbSheetHeadersMap = {};
    let dbAllHeaders = [];
    let dbCustomSubjectNames = {};

    function syncTeacherGrades() {
      const syncStatus = document.getElementById("sync-status");
      if (syncStatus) {
        syncStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังซิงค์ข้อมูล...';
        syncStatus.className = "text-warning";
      }

      const currentPin = sessionStorage.getItem("teacher_session_pin") || dbTeacherPin || "1234";

      if (isGAS || getBackendURL()) {
        callBackendAPI("fetchAllGrades", { pin: currentPin })
          .then(res => {
            if (res && res.status === "success") {
              dbGrades = res.data || [];
              dbSheetNames = res.sheetNames || [];
              dbClassrooms = res.classrooms || [];
              dbAllHeaders = res.allHeaders || [];
              dbSheetHeadersMap = res.sheetHeadersMap || {};
              dbCustomSubjectNames = res.customSubjectNames || {};
              
              dbHeaders = dbAllHeaders; // สำหรับการทำงานทั่วไป
              
              if (syncStatus) {
                syncStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> ซิงค์ Google Sheets เรียบร้อย';
                syncStatus.className = "text-success";
              }

              // Refresh current tab
              const activeItem = document.querySelector(".sidebar-item.active");
              if (activeItem) {
                const activeTab = activeItem.id.replace("snav-", "");
                switchTeacherTab(activeTab);
              }
            } else {
              showToast("❌ โหลดข้อมูลล้มเหลว: " + res.message, "danger");
            }
          })
          .catch(err => {
            showToast("❌ การเชื่อมต่อล้มเหลว: " + err.message, "danger");
          });
      } else {
        // Local mode fallback
        dbHeaders = DEFAULT_HEADERS;
        dbGrades = DEFAULT_MOCK_DATA;
        dbAllHeaders = DEFAULT_HEADERS;
        
        dbSheetNames.forEach(sheet => {
          dbSheetHeadersMap[sheet] = DEFAULT_HEADERS;
        });
        
        if (syncStatus) {
          syncStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> ซิงค์ Local เรียบร้อย';
          syncStatus.className = "text-success";
        }
        
        const activeItem = document.querySelector(".sidebar-item.active");
        if (activeItem) {
          const activeTab = activeItem.id.replace("snav-", "");
          switchTeacherTab(activeTab);
        }
      }
    }

    // -------------------------------------------------------------
    // THEME & INTERFACE SETTINGS
    // -------------------------------------------------------------
    function setTheme(theme) {
      document.body.className = 'theme-' + theme;
      if (isDarkMode) document.body.classList.add("dark-mode");
      activeTheme = theme;
      SafeStorage.setItem("app_theme", theme);

      // Manage active states of theme selector
      document.querySelectorAll(".theme-badge").forEach(btn => btn.classList.remove("active"));
      const badge = document.querySelector(`.badge-${theme}`);
      if (badge) badge.classList.add("active");
      
      // Re-draw charts
      updateStudentChartsColorTheme();
    }

    function toggleDarkLightMode() {
      isDarkMode = !isDarkMode;
      document.body.classList.toggle("dark-mode", isDarkMode);
      SafeStorage.setItem("app_dark_mode", isDarkMode);
      document.getElementById("theme-toggle-btn").innerHTML = isDarkMode 
        ? '<i class="fa-solid fa-sun"></i>' 
        : '<i class="fa-solid fa-moon"></i>';
      
      updateStudentChartsColorTheme();
    }

    function showSection(secId) {
      document.querySelectorAll(".app-section").forEach(s => s.classList.remove("active"));
      const target = document.getElementById(secId);
      if (target) {
        target.classList.add("active");
        activeSection = secId;
      }
    }

    // -------------------------------------------------------------
    // STUDENT LOGIC
    // -------------------------------------------------------------
    let studentFoundRecords = [];
    let studentActiveRecordIndex = 0;

    function handleStudentSearch(e) {
      e.preventDefault();
      const classroom = document.getElementById("search-classroom").value;
      const studentId = document.getElementById("search-student-id").value.trim();

      if (!classroom || !studentId) {
        showToast("⚠️ กรุณากรอกรหัสประจำตัวและเลือกห้องเรียน", "warning");
        return;
      }

      showToast("🔍 กำลังสแกนหาข้อมูลนักเรียน...", "info");

      if (isGAS || getBackendURL()) {
        callBackendAPI("searchStudent", { studentId: studentId, classroom: classroom })
          .then(res => {
            if (res && res.status === "success") {
              if (res.results && res.results.length > 0) {
                studentFoundRecords = res.results;
                studentActiveRecordIndex = 0;
                renderStudentReport();
                showSection("student-report-sec");
                showToast("✨ พบผลการเรียน " + res.results.length + " รายวิชา", "success");
              } else {
                alert("❌ ไม่พบข้อมูลเกรดของรหัสประจำตัว " + studentId + " ในห้องเรียน " + classroom + "\nกรุณาตรวจสอบข้อมูลกับคุณครูผู้สอน");
              }
            } else {
              showToast("❌ เกิดข้อผิดพลาดของระบบเซิร์ฟเวอร์", "danger");
            }
          })
          .catch(err => {
            showToast("❌ เกิดข้อผิดพลาดการสื่อสาร: " + err.message, "danger");
          });
      } else {
        // Local simulation lookup across mock database
        const matches = dbGrades.filter(g => 
          String(g.student_id).trim() === studentId && 
          String(g.classroom).trim() === classroom
        );

        if (matches.length > 0) {
          studentFoundRecords = matches.map(m => ({
            sheetName: m.classroom + "_" + m.subject_name,
            headers: dbHeaders,
            data: m
          }));
          studentActiveRecordIndex = 0;
          renderStudentReport();
          showSection("student-report-sec");
          showToast("✨ พบคะแนนตัวอย่าง (ออฟไลน์)", "success");
        } else {
          alert("❌ ไม่พบข้อมูลนักเรียนตัวอย่างรหัสนี้\n(ข้อมูลทดลองออฟไลน์ในระบบคือ รหัส: 69001 หรือ 68001)");
        }
      }
    }

    function renderStudentReport() {
      if (studentFoundRecords.length === 0) return;
      
      const primaryRecord = studentFoundRecords[0].data;
      
      // 1. Profile information
      document.getElementById("report-student-name").textContent = primaryRecord.name || "-";
      document.getElementById("report-student-id").textContent = primaryRecord.student_id || "-";
      document.getElementById("report-classroom").textContent = primaryRecord.classroom || "-";
      document.getElementById("report-student-no").textContent = primaryRecord.student_no || "-";

      // 2. Dynamic Subject tab rendering with modern capsule buttons
      const tabBox = document.getElementById("student-subject-tabs");
      tabBox.innerHTML = "";
      
      studentFoundRecords.forEach((rec, idx) => {
        const btn = document.createElement("button");
        btn.className = `student-tab-btn ${idx === studentActiveRecordIndex ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid fa-book-open"></i> ${rec.data.subject_name || rec.sheetName}`;
        btn.onclick = () => {
          studentActiveRecordIndex = idx;
          renderStudentSubjectData();
        };
        tabBox.appendChild(btn);
      });

      // Render total subject summary
      document.getElementById("stat-total-subjects").textContent = studentFoundRecords.length;
      
      let totalGPA = 0;
      let totalScores = 0;
      
      studentFoundRecords.forEach(rec => {
        const calc = calculateScoresAndGrades(rec.data, rec.headers);
        totalGPA += Number(calc.grade);
        totalScores += Number(calc.totalScore);
      });
      
      const avgGPA = (totalGPA / studentFoundRecords.length).toFixed(2);
      const avgPercent = (totalScores / studentFoundRecords.length).toFixed(1);
      
      document.getElementById("stat-gpa").textContent = avgGPA;
      document.getElementById("stat-average-score").textContent = avgPercent + "%";

      // Bento Passport: Dynamic Color Badge & Status for GPA
      const gpaCircle = document.getElementById("gpa-badge-circle");
      const gpaStatusText = document.getElementById("stat-gpa-status");
      if (gpaCircle) {
        gpaCircle.className = "gpa-circle";
        const numGpa = Number(avgGPA);
        if (numGpa >= 3.50) {
          gpaCircle.classList.add("gpa-emerald");
          if (gpaStatusText) {
            gpaStatusText.textContent = "ผลการเรียนดีเยี่ยม ⭐";
            gpaStatusText.style.color = "#059669";
          }
        } else if (numGpa >= 2.50) {
          gpaCircle.classList.add("gpa-blue");
          if (gpaStatusText) {
            gpaStatusText.textContent = "ผลการเรียนอยู่ในเกณฑ์ดี 👍";
            gpaStatusText.style.color = "#0284c7";
          }
        } else if (numGpa >= 2.00) {
          gpaCircle.classList.add("gpa-amber");
          if (gpaStatusText) {
            gpaStatusText.textContent = "เกณฑ์ปานกลาง 📖";
            gpaStatusText.style.color = "#d97706";
          }
        } else {
          gpaCircle.classList.add("gpa-danger");
          if (gpaStatusText) {
            gpaStatusText.textContent = "ควรปรับปรุงผลการเรียน ⚠️";
            gpaStatusText.style.color = "#dc2626";
          }
        }
      }

      // Magic UI: Confetti Celebration Trigger for Grade 4 or High GPA
      let hasGrade4 = false;
      studentFoundRecords.forEach(rec => {
        const calc = calculateScoresAndGrades(rec.data, rec.headers);
        if (Number(calc.grade) === 4) hasGrade4 = true;
      });

      if (Number(avgGPA) >= 3.50 || hasGrade4) {
        setTimeout(() => {
          triggerMagicConfetti();
        }, 500);
      }

      // Load specific details of selected tab
      renderStudentSubjectData();
    }

    function renderStudentSubjectData() {
      // Highlight current tab button
      document.querySelectorAll(".student-tab-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx === studentActiveRecordIndex);
      });

      const currentItem = studentFoundRecords[studentActiveRecordIndex];
      const data = currentItem.data;
      const headers = currentItem.headers;

      // Calculate details
      const calc = calculateScoresAndGrades(currentItem.data, currentItem.headers);

      // Helper to detect missing work
      const isMissingValue = val => {
        if (val === "" || val === null || val === undefined) return true;
        const s = String(val).trim().toLowerCase();
        return s === "ยังไม่ส่ง" || s === "ขาดส่ง" || s === "ขาด" || s === "-";
      };

      // Helper for HTML escaping
      const escapeHtml = str => {
        if (!str) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Render Alert system cards
      const alertList = document.getElementById("student-alert-list");
      alertList.innerHTML = "";
      let alertCount = 0;

      // Teacher Comment Highlight in Top Alert Box
      if (data.comment && String(data.comment).trim() !== "" && String(data.comment).trim() !== "-") {
        const li = document.createElement("li");
        li.className = "teacher-comment-alert";
        li.innerHTML = `
          <div class="teacher-comment-badge"><i class="fa-solid fa-chalkboard-user"></i> ข้อเสนอแนะจากคุณครูผู้สอน</div>
          <div class="teacher-comment-content">"${escapeHtml(data.comment)}"</div>
        `;
        alertList.appendChild(li);
        alertCount++;
      }

      // Rule A: Failing check
      if (Number(calc.totalScore) < 50) {
        const li = document.createElement("li");
        li.className = "critical";
        li.innerHTML = `<strong>🚨 สถานะวิกฤต:</strong> คะแนนรวมไม่ผ่านเกณฑ์ (ได้ ${calc.totalScore}/100) เสี่ยงติด 0 กรุณาติดต่อคุณครูผู้สอนเพื่อขอคำแนะนำและแก้ไขงาน`;
        alertList.appendChild(li);
        alertCount++;
      }

      // Rule B: Borderline check (Close to next grade)
      const diffToNext = calc.neededForNextGrade;
      if (diffToNext !== null && diffToNext <= 1.5 && diffToNext > 0) {
        const li = document.createElement("li");
        li.className = "warning";
        li.innerHTML = `<strong>⚠️ ขาดอีกนิดเดียว:</strong> ขาดอีกเพียง <strong>${diffToNext} คะแนน</strong> จะได้รับการปรับเลื่อนเป็น <strong>เกรด ${calc.nextGrade}</strong>`;
        alertList.appendChild(li);
        alertCount++;
      }

      // Rule C: Missing Tasks check (including "ยังไม่ส่ง" / "ขาดส่ง")
      const scoreHeaders = getScoreHeaders(headers);
      const missingTasks = [];
      scoreHeaders.forEach(sh => {
        if (isMissingValue(data[sh])) {
          missingTasks.push(sh);
        }
      });
      if (missingTasks.length > 0) {
        const li = document.createElement("li");
        li.className = "warning";
        li.innerHTML = `<strong>📝 งานค้างส่ง (${missingTasks.length} รายการ):</strong> นักเรียนมีงานที่ยังไม่ส่งหรือยังไม่มีคะแนนในหัวข้อ <em>"${missingTasks.join(', ')}"</em> กรุณาเร่งติดต่อคุณครูผู้สอนเพื่อส่งงานปรับคะแนนครับ`;
        alertList.appendChild(li);
        alertCount++;
      }

      // Rule D: Praise
      if (Number(calc.grade) === 4) {
        const li = document.createElement("li");
        li.className = "success-alert";
        li.innerHTML = `<strong>🎉 ผลงานดีเลิศ:</strong> วิชา ${data.subject_name} ได้คะแนนเต็มสัดส่วน ได้เกรด 4 ยินดีด้วยครับ! รักษาระดับความตั้งใจนี้ไว้นะครับ <button type="button" class="role-btn btn-primary magic-shimmer-btn" onclick="triggerMagicConfetti()" style="margin-left: 10px; padding: 4px 12px; font-size: 11px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-wand-magic-sparkles"></i> ยิงพลุฉลอง 🎉</button>`;
        alertList.appendChild(li);
        alertCount++;
      }

      if (alertCount === 0) {
        const li = document.createElement("li");
        li.className = "success-alert";
        li.innerHTML = `✨ นักเรียนมีผลสัมฤทธิ์ดีปกติในวิชานี้ ไม่มีงานค้างสะสม และผ่านเกณฑ์การเรียนอย่างสมบูรณ์แบบ`;
        alertList.appendChild(li);
      }

      // Render Dynamic Score Table with 2-Tier Grouped Headers
      const reportThead = document.getElementById("report-table-thead") || document.querySelector(".score-table thead");
      const tableBody = document.getElementById("report-table-body");

      // Tier 1: Group Category Headers
      let groupRowHtml = `<th colspan="2" class="th-group-header th-group-course"><i class="fa-solid fa-book-bookmark"></i> ข้อมูลรายวิชา</th>`;
      if (scoreHeaders.length > 0) {
        groupRowHtml += `<th colspan="${scoreHeaders.length}" class="th-group-header th-group-collect"><i class="fa-solid fa-pen-to-square"></i> คะแนนเก็บระหว่างภาค</th>`;
      }
      groupRowHtml += `
        <th colspan="2" class="th-group-header th-group-exam"><i class="fa-solid fa-bullseye"></i> การประเมินผลสอบ</th>
        <th colspan="3" class="th-group-header th-group-summary"><i class="fa-solid fa-trophy"></i> สรุปผลการเรียน</th>
        <th colspan="1" class="th-group-header th-group-comment"><i class="fa-solid fa-comment-dots"></i> ข้อเสนอแนะ</th>
      `;

      // Tier 2: Sub-column Headers
      let subRowHtml = `
        <th class="th-sub th-sub-course">รหัสวิชา</th>
        <th class="th-sub th-sub-course text-left">วิชาเรียน</th>
      `;
      scoreHeaders.forEach(sh => {
        subRowHtml += `<th class="th-sub th-sub-collect">${escapeHtml(sh)}</th>`;
      });
      subRowHtml += `
        <th class="th-sub th-sub-exam">กลางภาค (20)</th>
        <th class="th-sub th-sub-exam">ปลายภาค (20)</th>
        <th class="th-sub th-sub-summary">คะแนนรวม (100)</th>
        <th class="th-sub th-sub-summary">เกรด</th>
        <th class="th-sub th-sub-summary">ผลประเมิน</th>
        <th class="th-sub th-sub-comment text-left">ความเห็นจากคุณครู</th>
      `;

      if (reportThead) {
        reportThead.innerHTML = `
          <tr class="tr-group-row">${groupRowHtml}</tr>
          <tr id="report-table-header" class="tr-sub-row">${subRowHtml}</tr>
        `;
      }

      let tdHtml = `
        <td class="font-semibold">${data.subject_code}</td>
        <td class="text-left font-semibold">${data.subject_name}</td>
      `;
      scoreHeaders.forEach(sh => {
        const val = data[sh];
        if (isMissingValue(val)) {
          const labelText = (val && String(val).trim() !== "-") ? String(val).trim() : "ยังไม่ส่ง";
          tdHtml += `<td><span class="badge-missing"><i class="fa-solid fa-clock-rotate-left"></i> ${labelText}</span></td>`;
        } else if (val === 0 || val === "0") {
          tdHtml += `<td><span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 700; display: inline-block;">0</span></td>`;
        } else {
          tdHtml += `<td>${val}</td>`;
        }
      });

      // Grade Pill Class
      let gradePillClass = "grade-pill-emerald";
      const numGrade = Number(calc.grade);
      if (numGrade >= 3.5) gradePillClass = "grade-pill-emerald";
      else if (numGrade >= 2.5) gradePillClass = "grade-pill-blue";
      else if (numGrade >= 1.5) gradePillClass = "grade-pill-amber";
      else if (numGrade > 0) gradePillClass = "grade-pill-amber";
      else gradePillClass = "grade-pill-danger";

      const badgeClass = calc.status === "ผ่าน" ? "badge-pass" : "badge-fail";
      const hasComment = data.comment && String(data.comment).trim() !== "" && String(data.comment).trim() !== "-";
      const commentHtml = hasComment
        ? `<div class="teacher-comment-card"><i class="fa-solid fa-comment-dots"></i> <span>${escapeHtml(data.comment)}</span></div>`
        : `<span class="text-muted">-</span>`;

      tdHtml += `
        <td>${data.midterm_score !== "" && data.midterm_score !== null ? data.midterm_score : "-"}</td>
        <td>${data.final_score !== "" && data.final_score !== null ? data.final_score : "-"}</td>
        <td><span class="score-total-chip">${calc.totalScore}</span></td>
        <td><span class="grade-pill ${gradePillClass}">${calc.grade}</span></td>
        <td><span class="badge ${badgeClass}">${calc.status}</span></td>
        <td class="text-left">${commentHtml}</td>
      `;
      tableBody.innerHTML = `<tr>${tdHtml}</tr>`;

      // Render specific charts
      drawStudentCharts(currentItem);
    }

    function backToSearch() {
      showSection("student-search-sec");
    }

    function calculateScoresAndGrades(studentRow, headers) {
      const midterm = Number(studentRow.midterm_score) || 0;
      const final = Number(studentRow.final_score) || 0;
      
      const scoreHeaders = getScoreHeaders(headers);
      let collectTotal = 0;
      let collectMax = 0;
      
      scoreHeaders.forEach(sh => {
        collectTotal += Number(studentRow[sh]) || 0;
        collectMax += parseMaxScore(sh);
      });

      // Use raw sum of scores directly as per user request
      const scaledCollect = collectTotal;
      const totalScore = collectTotal + midterm + final;
      
      let grade = 0;
      if (totalScore >= 80) grade = 4;
      else if (totalScore >= 75) grade = 3.5;
      else if (totalScore >= 70) grade = 3;
      else if (totalScore >= 65) grade = 2.5;
      else if (totalScore >= 60) grade = 2;
      else if (totalScore >= 55) grade = 1.5;
      else if (totalScore >= 50) grade = 1;
      else grade = 0;

      // Calculate borderline difference to next grade
      const thresholds = [50, 55, 60, 65, 70, 75, 80];
      const nextGrades = [1, 1.5, 2, 2.5, 3, 3.5, 4];
      let neededForNextGrade = null;
      let nextGrade = null;
      for (let i = 0; i < thresholds.length; i++) {
        const diff = thresholds[i] - totalScore;
        if (diff > 0 && diff <= 1.5) {
          neededForNextGrade = diff.toFixed(1);
          nextGrade = nextGrades[i];
          break;
        }
      }

      return {
        collectTotal: collectTotal.toFixed(1),
        collectMax: collectMax,
        scaledCollect: scaledCollect.toFixed(1),
        totalScore: totalScore.toFixed(1),
        grade: grade,
        status: totalScore >= 50 ? "ผ่าน" : "ไม่ผ่าน",
        neededForNextGrade: neededForNextGrade,
        nextGrade: nextGrade
      };
    }

    function getScoreHeaders(headers) {
      const fixedHeaders = ["student_id", "name", "classroom", "student_no", "subject_code", "subject_name", "midterm_score", "final_score", "comment"];
      return headers.filter(h => {
        if (!h) return false;
        const s = String(h).trim();
        if (fixedHeaders.includes(s)) return false;
        
        // กรองข้ามคอลัมน์ผลสรุป (Summary Columns)
        if (s.includes("คะแนนรวม") || s === "total_score" || s.toLowerCase() === "total") return false;
        if (s === "เกรด" || s.toLowerCase() === "grade") return false;
        if (s === "ผลประเมิน" || s.toLowerCase() === "status" || s.toLowerCase() === "evaluation") return false;
        
        // กรองข้ามคอลัมน์รวมรายบท/รายหน่วย (Anti-Double Counting)
        // แสดงเฉพาะใน Google Sheets เท่านั้น ไม่นำมาบวกทบซ้ำ และไม่แสดงซ้ำซ้อนในตารางหน้าเว็บ
        if (s.startsWith("รวมบท") || s.startsWith("รวมหน่วย") || s.startsWith("คะแนนรวมบท") || s.startsWith("คะแนนรวมหน่วย") || s.toLowerCase().includes("subtotal")) {
          return false;
        }
        
        return true;
      });
    }

    function parseMaxScore(headerName) {
      const match = headerName.match(/\((\d+)\)/);
      return match ? parseInt(match[1], 10) : 10;
    }

    // -------------------------------------------------------------
    // STUDENT CHARTS
    // -------------------------------------------------------------
    function drawStudentCharts(recordItem) {
      const data = recordItem.data;
      const headers = recordItem.headers;
      const calc = calculateScoresAndGrades(data, headers);

      const labelName = data.subject_name;

      // 1. Peer Comparison Score average
      let classroomAverage = 72; // Default baseline
      if (dbGrades && dbGrades.length > 0) {
        const classmates = dbGrades.filter(g => 
          g.classroom === data.classroom && 
          g.subject_code === data.subject_code
        );
        if (classmates.length > 0) {
          let sum = 0;
          classmates.forEach(mate => {
            const mateCalc = calculateScoresAndGrades(mate, headers);
            sum += Number(mateCalc.totalScore);
          });
          classroomAverage = sum / classmates.length;
        }
      }

      const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#3b82f6';
      const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#06b6d4';
      const isDark = document.body.classList.contains("dark-mode");
      const textColor = isDark ? '#f1f5f9' : '#1e293b';
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

      // Bar Chart
      if (studentBarChartInstance) studentBarChartInstance.destroy();
      const ctxBar = document.getElementById("studentBarChart").getContext("2d");
      studentBarChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: ['คุณ', 'เฉลี่ยทั้งห้อง'],
          datasets: [{
            label: 'คะแนนรวมดิบ (เต็ม 100)',
            data: [Number(calc.totalScore), classroomAverage],
            backgroundColor: [primaryColor, '#94a3b8'],
            borderRadius: 8,
            barThickness: 45
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: textColor }, grid: { display: false } },
            y: { min: 0, max: 100, ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });

      // Radar / Polar Area Chart
      const scoreHeaders = getScoreHeaders(headers);
      const radarLabels = ['คะแนนเก็บสะสม (เต็ม 60)', 'กลางภาค (เต็ม 20)', 'ปลายภาค (เต็ม 20)'];
      const radarData = [Number(calc.scaledCollect), Number(data.midterm_score) || 0, Number(data.final_score) || 0];

      if (studentRadarChartInstance) studentRadarChartInstance.destroy();
      const ctxRadar = document.getElementById("studentRadarChart").getContext("2d");
      studentRadarChartInstance = new Chart(ctxRadar, {
        type: 'polarArea',
        data: {
          labels: radarLabels,
          datasets: [{
            data: radarData,
            backgroundColor: [
              'rgba(59, 130, 246, 0.35)',
              'rgba(245, 158, 11, 0.35)',
              'rgba(16, 185, 129, 0.35)'
            ],
            borderColor: [primaryColor, '#f59e0b', '#10b981'],
            borderWidth: 1.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textColor, font: { family: 'Sarabun' } } }
          },
          scales: {
            r: {
              grid: { color: gridColor },
              angleLines: { color: gridColor },
              ticks: { backdropColor: 'transparent', color: textColor },
              pointLabels: { color: textColor }
            }
          }
        }
      });
    }

    function updateStudentChartsColorTheme() {
      if (activeSection === "student-report-sec") {
        renderStudentSubjectData();
      } else if (activeSection === "teacher-workspace-sec" && isTeacherLoggedIn) {
        drawTeacherDashboardCharts();
      }
    }

    // -------------------------------------------------------------
    // TEACHER LOGIN & NAV MANAGEMENT
    // -------------------------------------------------------------
    function promptRoleChange() {
      if (isTeacherLoggedIn) {
        showSection("teacher-workspace-sec");
        switchTeacherTab("overview");
      } else {
        const passInput = document.getElementById("teacher-password");
        if (passInput) passInput.value = "";
        const errorMsg = document.getElementById("login-error-msg");
        if (errorMsg) errorMsg.classList.add("d-none");
        openModal("teacher-login-modal");
        setTimeout(() => {
          if (passInput) passInput.focus();
        }, 100);
      }
    }

    function enterTeacherMode(silent = false) {
      isTeacherLoggedIn = true;
      SafeStorage.setItem("is_teacher_logged_in", "true");
      
      const modal = document.getElementById("teacher-login-modal");
      if (modal) closeModal("teacher-login-modal");
      
      const btn = document.getElementById("role-switch-btn");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-gears"></i> แผงควบคุมของคุณครู';
        btn.className = "role-btn btn-secondary";
      }
      
      showSection("teacher-workspace-sec");
      syncTeacherGrades(); // โหลดข้อมูลทุกชีทเข้ามาในสมุดเกรดและแดชบอร์ดทันที
      
      if (!silent) {
        showToast("🔓 ปลดล็อคระบบคุณครูสำเร็จ", "success");
      }
    }

    function verifyTeacherLogin() {
      const input = document.getElementById("teacher-password");
      const enteredPIN = input ? input.value.trim() : "";
      const errorMsg = document.getElementById("login-error-msg");

      if (!enteredPIN) {
        showToast("⚠️ กรุณากรอกรหัสผ่าน PIN", "warning");
        return;
      }

      const localValidPin = String((typeof dbTeacherPin !== "undefined" && dbTeacherPin) ? dbTeacherPin : "1234").trim();

      // If matches local pin, enter directly
      if (enteredPIN === localValidPin) {
        sessionStorage.setItem("teacher_session_pin", enteredPIN);
        if (errorMsg) errorMsg.classList.add("d-none");
        enterTeacherMode();
        return;
      }

      // Verify custom PIN configured in Google Sheets Config tab
      showToast("🔑 กำลังตรวจสอบรหัสผ่าน...", "info");
      callBackendAPI("fetchAllGrades", { pin: enteredPIN })
        .then(res => {
          if (res && res.status === "success") {
            sessionStorage.setItem("teacher_session_pin", enteredPIN);
            dbTeacherPin = enteredPIN;
            if (errorMsg) errorMsg.classList.add("d-none");
            
            // Populate grades data received directly from verification
            if (res.data) {
              dbGrades = res.data || [];
              dbSheetNames = res.sheetNames || [];
              dbClassrooms = res.classrooms || [];
              dbAllHeaders = res.allHeaders || [];
              dbSheetHeadersMap = res.sheetHeadersMap || {};
              dbCustomSubjectNames = res.customSubjectNames || {};
              dbHeaders = dbAllHeaders;
            }
            
            enterTeacherMode();
          } else {
            if (enteredPIN === "1234") {
              sessionStorage.setItem("teacher_session_pin", enteredPIN);
              if (errorMsg) errorMsg.classList.add("d-none");
              enterTeacherMode();
            } else {
              if (errorMsg) errorMsg.classList.remove("d-none");
              showToast("❌ รหัส PIN ไม่ถูกต้อง", "danger");
            }
          }
        })
        .catch(err => {
          if (enteredPIN === "1234" || enteredPIN === localValidPin) {
            sessionStorage.setItem("teacher_session_pin", enteredPIN);
            if (errorMsg) errorMsg.classList.add("d-none");
            enterTeacherMode();
          } else {
            if (errorMsg) errorMsg.classList.remove("d-none");
            showToast("❌ ระบบขัดข้อง: " + err.message, "danger");
          }
        });
    }

    function exitTeacherMode() {
      isTeacherLoggedIn = false;
      SafeStorage.setItem("is_teacher_logged_in", "false");
      sessionStorage.removeItem("teacher_session_pin"); // ลบ PIN ออกจากหน่วยความจำชั่วคราว
      
      const btn = document.getElementById("role-switch-btn");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i> เข้าสู่โหมดคุณครู';
        btn.className = "role-btn btn-primary";
      }
      
      showSection("student-search-sec");
      showToast("🔒 ล็อคความปลอดภัยระบบคุณครูแล้ว", "info");
    }

    function switchTeacherTab(tab) {
      document.querySelectorAll(".sidebar-item").forEach(item => item.classList.remove("active"));
      document.querySelectorAll(".teacher-tab").forEach(tabPanel => tabPanel.classList.remove("active"));

      const snav = document.getElementById('snav-' + tab);
      const panel = document.getElementById('teacher-tab-' + tab);

      if (snav) snav.classList.add("active");
      if (panel) panel.classList.add("active");

      // Set titles
      const title = document.getElementById("teacher-workspace-title");
      if (title) {
        if (tab === "overview") {
          title.textContent = "แดชบอร์ดภาพรวมรายวิชา";
        } else if (tab === "alerts") {
          title.textContent = "ระบบสแกนงานค้างและแจ้งเตือนเด็ก";
        } else if (tab === "gradebook") {
          title.textContent = "ตารางรายงานคะแนนนักเรียน";
        } else if (tab === "summary-report") {
          title.textContent = "รายงานสรุปผลสัมฤทธิ์ทางการเรียน";
        } else if (tab === "settings") {
          title.textContent = "ตั้งค่าการเชื่อมต่อ";
        }
      }
      
      // Load data
      if (tab === "overview") {
        renderTeacherOverview();
      } else if (tab === "alerts") {
        renderTeacherAlertsTab();
      } else if (tab === "gradebook") {
        renderTeacherGradebookTab();
      } else if (tab === "summary-report") {
        renderTeacherSummaryReport();
      } else if (tab === "settings") {
        const urlInput = document.getElementById("settings-web-app-url");
        if (urlInput) {
          urlInput.value = getBackendURL();
        }
      }
    }

    // -------------------------------------------------------------
    // TEACHER TAB A: OVERVIEW
    // -------------------------------------------------------------
    function renderTeacherOverview() {
      // Stats count
      const rooms = [...new Set(dbGrades.map(g => g.classroom))];
      const studentIds = [...new Set(dbGrades.map(g => g.student_id))];
      
      document.getElementById("tstat-total-subjects").textContent = dbSheetNames.length;
      document.getElementById("tstat-total-students").textContent = studentIds.length;

      let gpaSum = 0;
      let totalGte25Count = 0;
      dbGrades.forEach(student => {
        const calc = calculateScoresAndGrades(student, dbHeaders);
        const gradeVal = Number(calc.grade);
        gpaSum += gradeVal;
        if (gradeVal >= 2.5) {
          totalGte25Count++;
        }
      });
      const avgGPA = dbGrades.length > 0 ? (gpaSum / dbGrades.length).toFixed(2) : "0.00";
      document.getElementById("tstat-gpa-average").textContent = avgGPA;

      // Update 4th stat card: Grade >= 2.5 %
      const totalGte25Percent = dbGrades.length > 0 ? ((totalGte25Count / dbGrades.length) * 100).toFixed(2) : "0.00";
      const gte25El = document.getElementById("tstat-gte25-percent");
      if (gte25El) gte25El.textContent = `${totalGte25Percent}%`;
      const gte25CountEl = document.getElementById("tstat-gte25-count");
      if (gte25CountEl) gte25CountEl.textContent = `${totalGte25Count} จาก ${dbGrades.length} คน`;

      // Group rooms stats table
      const tableBody = document.getElementById("teacher-overview-table-body");
      tableBody.innerHTML = "";
      
      const classroomList = [...new Set(dbGrades.map(g => g.classroom))].sort();
      classroomList.forEach(room => {
        const roomStudents = dbGrades.filter(g => g.classroom === room);
        let scoreSum = 0;
        let gpaRoomSum = 0;
        let passCount = 0;
        let roomGte25Count = 0;

        roomStudents.forEach(st => {
          const calc = calculateScoresAndGrades(st, dbHeaders);
          const gradeVal = Number(calc.grade);
          scoreSum += Number(calc.totalScore);
          gpaRoomSum += gradeVal;
          if (calc.status === "ผ่าน") passCount++;
          if (gradeVal >= 2.5) roomGte25Count++;
        });

        const roomAvgScore = roomStudents.length > 0 ? (scoreSum / roomStudents.length).toFixed(1) : "0.0";
        const roomAvgGpa = roomStudents.length > 0 ? (gpaRoomSum / roomStudents.length).toFixed(2) : "0.00";
        const passPercent = roomStudents.length > 0 ? ((passCount / roomStudents.length) * 100).toFixed(0) : "0";
        const roomGte25Percent = roomStudents.length > 0 ? ((roomGte25Count / roomStudents.length) * 100).toFixed(2) : "0.00";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="font-semibold">${room}</td>
          <td>${roomStudents.length} คน</td>
          <td class="font-bold text-primary">${roomAvgScore}</td>
          <td class="font-bold text-success">${roomAvgGpa}</td>
          <td><span class="badge ${passPercent >= 70 ? 'badge-pass' : 'badge-fail'}">${passPercent}% ผ่าน</span></td>
          <td><span class="badge ${Number(roomGte25Percent) >= 60 ? 'badge-pass' : 'badge-fail'}" style="font-size: 11px; padding: 3px 9px;">${roomGte25Percent}%</span></td>
        `;
        tableBody.appendChild(tr);
      });

      // Draw overall charts
      drawTeacherDashboardCharts();
    }

    function drawTeacherDashboardCharts() {
      // Calculate grade distribution counts (0, 1, 1.5, 2, 2.5, 3, 3.5, 4)
      const gradeCounts = { "0": 0, "1": 0, "1.5": 0, "2": 0, "2.5": 0, "3": 0, "3.5": 0, "4": 0 };
      let passCount = 0;
      let failCount = 0;

      dbGrades.forEach(st => {
        const calc = calculateScoresAndGrades(st, dbHeaders);
        gradeCounts[String(calc.grade)] = (gradeCounts[String(calc.grade)] || 0) + 1;
        if (calc.status === "ผ่าน") passCount++;
        else failCount++;
      });

      const isDark = document.body.classList.contains("dark-mode");
      const textColor = isDark ? '#f1f5f9' : '#1e293b';
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
      const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#3b82f6';

      // Bar Chart for grades
      if (teacherBarChartInstance) teacherBarChartInstance.destroy();
      const ctxBar = document.getElementById("teacherBarChart").getContext("2d");
      teacherBarChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: ['0', '1', '1.5', '2', '2.5', '3', '3.5', '4'],
          datasets: [{
            label: 'จำนวนนักเรียน (คน)',
            data: [
              gradeCounts["0"] || 0,
              gradeCounts["1"] || 0,
              gradeCounts["1.5"] || 0,
              gradeCounts["2"] || 0,
              gradeCounts["2.5"] || 0,
              gradeCounts["3"] || 0,
              gradeCounts["3.5"] || 0,
              gradeCounts["4"] || 0
            ],
            backgroundColor: primaryColor,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: textColor }, grid: { display: false } },
            y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
          }
        }
      });

      // Pie Chart for Pass/Fail
      if (teacherPieChartInstance) teacherPieChartInstance.destroy();
      const ctxPie = document.getElementById("teacherPieChart").getContext("2d");
      teacherPieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: ['สอบผ่านเกณฑ์ (>= 50)', 'ยังไม่ผ่านเกณฑ์ (< 50)'],
          datasets: [{
            data: [passCount, failCount],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 2,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Sarabun' } } }
          }
        }
      });
    }

    // -------------------------------------------------------------
    // TEACHER TAB B: ALERTS (ระบบตามงานเด็ก)
    // -------------------------------------------------------------
    function filterTeacherAlerts(type) {
      activeAlertTab = type;
      
      // Update Tab state styles
      document.getElementById("alert-tab-red").className = `role-btn ${type === 'red' ? 'btn-primary' : 'btn-secondary'}`;
      document.getElementById("alert-tab-yellow").className = `role-btn ${type === 'yellow' ? 'btn-primary' : 'btn-secondary'}`;
      document.getElementById("alert-tab-blue").className = `role-btn ${type === 'blue' ? 'btn-primary' : 'btn-secondary'}`;
      
      renderTeacherAlertsTab();
    }

    function renderTeacherAlertsTab() {
      const container = document.getElementById("teacher-alerts-content");
      container.innerHTML = "";
      
      let count = 0;
      
      if (activeAlertTab === "red") {
        container.innerHTML = `<h4 class="alert-section-title">🚨 วิกฤต: รายชื่อเด็กนักเรียนสอบตก (คะแนนรวมต่ำกว่า 50)</h4>`;
        
        dbGrades.forEach(st => {
          const calc = calculateScoresAndGrades(st, dbHeaders);
          if (Number(calc.totalScore) < 50) {
            const box = document.createElement("div");
            box.style.padding = "10px 15px";
            box.style.borderLeft = "4px solid var(--danger)";
            box.style.background = "rgba(239, 68, 68, 0.05)";
            box.style.marginBottom = "10px";
            box.style.borderRadius = "8px";
            box.innerHTML = `
              <strong>รหัส ${st.student_id} - ${st.name}</strong> (เลขที่ ${st.student_no} ห้อง ${st.classroom}) | 
              คะแนนปัจจุบัน: <span class="text-danger font-bold">${calc.totalScore} คะแนน</span> (กลางภาค ${st.midterm_score || 0}, ปลายภาค ${st.final_score || 0})
            `;
            container.appendChild(box);
            count++;
          }
        });
      } else if (activeAlertTab === "yellow") {
        container.innerHTML = `<h4 class="alert-section-title">⚠️ คาบเกี่ยวเกรด: ขาดไม่เกิน 1.5 คะแนนเพื่อปรับขึ้นเกรดใหม่</h4>`;
        
        dbGrades.forEach(st => {
          const calc = calculateScoresAndGrades(st, dbHeaders);
          const currentScore = Number(calc.totalScore);
          const thresholds = [50, 55, 60, 65, 70, 75, 80];
          const nextGrades = [1, 1.5, 2, 2.5, 3, 3.5, 4];
          
          for (let i = 0; i < thresholds.length; i++) {
            const diff = thresholds[i] - currentScore;
            if (diff > 0 && diff <= 1.5) {
              const box = document.createElement("div");
              box.style.padding = "10px 15px";
              box.style.borderLeft = "4px solid var(--warning)";
              box.style.background = "rgba(245, 158, 11, 0.05)";
              box.style.marginBottom = "10px";
              box.style.borderRadius = "8px";
              box.innerHTML = `
                <strong>รหัส ${st.student_id} - ${st.name}</strong> (ห้อง ${st.classroom}) | 
                ได้คะแนน: <span class="font-bold">${calc.totalScore}</span> (เกรด ${calc.grade}) 
                👉 <span class="text-success font-bold">ขาดอีกเพียง ${diff.toFixed(1)} คะแนน</span> จะได้ปรับขึ้นเป็น<strong>เกรด ${nextGrades[i]}</strong>
              `;
              container.appendChild(box);
              count++;
              break;
            }
          }
        });
      } else if (activeAlertTab === "blue") {
        container.innerHTML = `<h4 class="alert-section-title">📝 ตารางตรวจสอบงานค้างค้างส่งรายหัวข้อ</h4>`;
        
        const scoreHeaders = getScoreHeaders(dbHeaders);
        
        dbGrades.forEach(st => {
          let missing = [];
          scoreHeaders.forEach(sh => {
            if (st[sh] === "" || st[sh] === null || Number(st[sh]) === 0) {
              missing.push(sh);
            }
          });

          if (missing.length > 0) {
            const box = document.createElement("div");
            box.style.padding = "10px 15px";
            box.style.borderLeft = "4px solid var(--primary)";
            box.style.background = "rgba(59, 130, 246, 0.05)";
            box.style.marginBottom = "10px";
            box.style.borderRadius = "8px";
            box.innerHTML = `
              <strong>รหัส ${st.student_id} - ${st.name}</strong> (ห้อง ${st.classroom}) | 
              งานค้างส่ง: <span class="text-primary font-bold">${missing.join(', ')}</span>
            `;
            container.appendChild(box);
            count++;
          }
        });
      }

      if (count === 0) {
        container.innerHTML += `
          <div style="text-align: center; padding: 30px; color: var(--text-muted);">
            <i class="fa-solid fa-square-check" style="font-size: 32px; color: var(--success); margin-bottom: 10px;"></i>
            <p>ไม่พบนักเรียนที่อยู่ในเกณฑ์การตรวจค้นหาข้อผิดพลาดประเภทนี้</p>
          </div>
        `;
      }
    }

    // -------------------------------------------------------------
    // TEACHER TAB C: GRADEBOOK (ตารางจัดการคะแนน)
    // -------------------------------------------------------------
    function renderTeacherGradebookTab() {
      // Re-populate filter lists
      const classroomFilter = document.getElementById("gradebook-filter-classroom");
      const subjectFilter = document.getElementById("gradebook-filter-subject");

      const uniqueClassrooms = [...new Set(dbGrades.map(g => g.classroom))].sort();
      const uniqueSubjects = [...new Set(dbGrades.map(g => g.subject_code))].sort();

      classroomFilter.innerHTML = '<option value="all">-- ทั้งหมด --</option>';
      uniqueClassrooms.forEach(cr => {
        classroomFilter.innerHTML += `<option value="${cr}">${cr}</option>`;
      });

      subjectFilter.innerHTML = '<option value="all">-- ทั้งหมด --</option>';
      uniqueSubjects.forEach(sj => {
        const rec = dbGrades.find(g => g.subject_code === sj);
        const name = rec ? rec.subject_name : sj;
        subjectFilter.innerHTML += `<option value="${sj}">${sj} - ${name}</option>`;
      });

      handleGradebookFilterChange();
    }

    function handleGradebookFilterChange() {
      const selectedClassroom = document.getElementById("gradebook-filter-classroom").value;
      const selectedSubject = document.getElementById("gradebook-filter-subject").value;

      // Filter rows
      const filteredData = dbGrades.filter(st => {
        const roomMatch = selectedClassroom === "all" || st.classroom === selectedClassroom;
        const subjMatch = selectedSubject === "all" || st.subject_code === selectedSubject;
        return roomMatch && subjMatch;
      });

      // Dynamic headers lookup based on filtered rows
      let activeHeaders = dbAllHeaders;
      if (filteredData.length > 0) {
        const uniqueSheets = [...new Set(filteredData.map(r => r._sheetName))];
        if (uniqueSheets.length === 1 && dbSheetHeadersMap[uniqueSheets[0]]) {
          activeHeaders = dbSheetHeadersMap[uniqueSheets[0]];
        }
      }

      // Render header
      const headerRow = document.getElementById("gradebook-table-header");
      let scoreHeaders = [];
      if (selectedSubject !== "all") {
        scoreHeaders = getScoreHeaders(activeHeaders);
      }

      let collectMaxSum = 0;
      if (scoreHeaders.length > 0) {
        collectMaxSum = scoreHeaders.reduce((sum, sh) => sum + parseMaxScore(sh), 0);
      }
      const collectHeaderTitle = collectMaxSum > 0 ? `คะแนนเก็บรวม (${collectMaxSum})` : "คะแนนเก็บรวม";
      
      let headerHtml = `
        <th>รหัสประจำตัว</th>
        <th>ชื่อ-นามสกุล</th>
        <th>ห้อง</th>
        <th>เลขที่</th>
        <th>รหัสวิชา</th>
      `;
      scoreHeaders.forEach(sh => {
        headerHtml += `<th class="header-editable" onclick="makeHeaderEditable(this, '${sh}')" title="คลิกเพื่อเปลี่ยนชื่อกิจกรรม/คะแนนเต็ม">${sh}</th>`;
      });
      headerHtml += `
        <th style="background: rgba(59, 130, 246, 0.08); color: var(--primary); font-weight: 700;">${collectHeaderTitle}</th>
        <th>กลางภาค (20)</th>
        <th>ปลายภาค (20)</th>
        <th>รวม (100)</th>
        <th>เกรด</th>
        <th>ความเห็น</th>
        <th class="no-print">จัดการ</th>
      `;
      headerRow.innerHTML = headerHtml;

      // Render data grid
      const body = document.getElementById("gradebook-table-body");
      body.innerHTML = "";

      if (filteredData.length === 0) {
        body.innerHTML = `<tr><td colspan="${12 + scoreHeaders.length}" style="text-align: center; color: var(--text-muted); padding: 30px;">ไม่มีนักเรียนที่ตรงกับตัวเลือกการกรองข้อมูล</td></tr>`;
        return;
      }

      filteredData.forEach(st => {
        const calc = calculateScoresAndGrades(st, activeHeaders);
        const tr = document.createElement("tr");

        let rowHtml = `
          <td class="cell-editable font-semibold" data-student-id="${st.student_id}" data-key="student_id" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'student_id', 'text')">${st.student_id}</td>
          <td class="cell-editable text-left font-semibold" data-student-id="${st.student_id}" data-key="name" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'name', 'text')">${st.name}</td>
          <td class="cell-editable" data-student-id="${st.student_id}" data-key="classroom" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'classroom', 'text')">${st.classroom}</td>
          <td class="cell-editable" data-student-id="${st.student_id}" data-key="student_no" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'student_no', 'number-free')">${st.student_no}</td>
          <td class="cell-editable" data-student-id="${st.student_id}" data-key="subject_code" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'subject_code', 'text')">${st.subject_code}</td>
        `;

        // Dynamic collect score columns
        scoreHeaders.forEach(sh => {
          const max = parseMaxScore(sh);
          const rawVal = st[sh];
          let cellContent = (rawVal !== undefined && rawVal !== null && rawVal !== "") ? rawVal : "-";
          
          // ตรวจจับคะแนน 0 หรือ ข้อความงานค้าง ("ยังไม่ส่ง", "ขาดส่ง", "ขาด", "-", "ร", "มส")
          // โดยเว้นช่องว่างเปล่า (rawVal === "" หรือ undefined/null) ไว้ ไม่ให้เป็นสีแดง
          const missingKeywords = ["ยังไม่ส่ง", "ขาดส่ง", "ขาด", "-", "ร", "มส"];
          const isExplicitZero = (rawVal === 0 || rawVal === "0");
          const isMissingKeyword = typeof rawVal === "string" && missingKeywords.includes(rawVal.trim());
          
          if (rawVal !== "" && rawVal !== null && rawVal !== undefined && (isExplicitZero || isMissingKeyword)) {
            cellContent = `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 700; display: inline-block;">${rawVal}</span>`;
          }

          rowHtml += `
            <td class="cell-editable" data-student-id="${st.student_id}" data-key="${sh}" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', '${sh}', ${max})">
              ${cellContent}
            </td>
          `;
        });

        // Collect Total, Midterm & Final score columns
        rowHtml += `
          <td class="font-bold text-primary" style="text-align: center; background: rgba(59, 130, 246, 0.04);">${calc.collectTotal}</td>
          <td class="cell-editable" data-student-id="${st.student_id}" data-key="midterm_score" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'midterm_score', 20)">
            ${(st.midterm_score !== undefined && st.midterm_score !== null && st.midterm_score !== "") ? st.midterm_score : "-"}
          </td>
          <td class="cell-editable" data-student-id="${st.student_id}" data-key="final_score" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'final_score', 20)">
            ${(st.final_score !== undefined && st.final_score !== null && st.final_score !== "") ? st.final_score : "-"}
          </td>
          <td class="font-bold text-primary">${calc.totalScore}</td>
          <td class="font-bold" style="text-align: center;">
            <span style="${(calc.grade === 'ร' || calc.grade === 'มส' || Number(calc.grade) === 0 || calc.status === 'ไม่ผ่าน') ? 'background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 6px; font-weight: 700; display: inline-block;' : (Number(calc.grade) < 2.5 ? 'background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 6px; font-weight: 700; display: inline-block;' : 'background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 6px; font-weight: 700; display: inline-block;')}">${calc.grade}</span>
          </td>
          <td class="cell-editable text-left small" data-student-id="${st.student_id}" data-key="comment" onclick="makeCellEditable(this, '${st.student_id}', '${st.subject_code}', 'comment', 'text')">
            ${st.comment || "-"}
          </td>
          <td class="no-print" style="text-align: center;">
            <button type="button" onclick="confirmDeleteStudent('${st.student_id}', '${st.subject_code}', '${st.name}')" style="padding: 4px 8px; font-size: 11px; border-radius: 6px; border: 1px solid var(--danger); color: var(--danger); background: transparent; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--danger)'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='var(--danger)'" title="ลบรายชื่อนักเรียนคนนี้">
              <i class="fa-solid fa-trash-can"></i> ลบ
            </button>
          </td>
        `;

        tr.innerHTML = rowHtml;
        body.appendChild(tr);
      });
    }

    // Editable cell event handlers
    let activeEditingCell = null;

    function navigateAndEdit(studentId, currentKey, direction) {
      const selectedClassroom = document.getElementById("gradebook-filter-classroom").value;
      const selectedSubject = document.getElementById("gradebook-filter-subject").value;
      const filteredData = dbGrades.filter(st => {
        const roomMatch = selectedClassroom === "all" || st.classroom === selectedClassroom;
        const subjMatch = selectedSubject === "all" || st.subject_code === selectedSubject;
        return roomMatch && subjMatch;
      });

      let currentHeaders = dbAllHeaders;
      if (filteredData.length > 0) {
        const uniqueSheets = [...new Set(filteredData.map(r => r._sheetName))];
        if (uniqueSheets.length === 1 && dbSheetHeadersMap[uniqueSheets[0]]) {
          currentHeaders = dbSheetHeadersMap[uniqueSheets[0]];
        }
      }
      const scoreHeaders = getScoreHeaders(currentHeaders);

      const keys = [
        "student_id",
        "name",
        "classroom",
        "student_no",
        "subject_code",
        ...scoreHeaders,
        "midterm_score",
        "final_score",
        "comment"
      ];

      const rows = Array.from(document.querySelectorAll("#gradebook-table-body tr"));
      const studentIds = rows.map(r => {
        const cell = r.querySelector("td[data-key='student_id']");
        return cell ? cell.textContent.trim() : null;
      }).filter(id => id !== null);

      let targetStudentId = studentId;
      let targetKey = currentKey;

      if (direction === "down" || direction === "up") {
        const idx = studentIds.indexOf(String(studentId).trim());
        if (idx !== -1) {
          if (direction === "down" && idx < studentIds.length - 1) {
            targetStudentId = studentIds[idx + 1];
          } else if (direction === "up" && idx > 0) {
            targetStudentId = studentIds[idx - 1];
          }
        }
      } else if (direction === "right" || direction === "left") {
        const idx = keys.indexOf(currentKey);
        if (idx !== -1) {
          if (direction === "right" && idx < keys.length - 1) {
            targetKey = keys[idx + 1];
          } else if (direction === "left" && idx > 0) {
            targetKey = keys[idx - 1];
          }
        }
      }

      if (targetStudentId && targetKey) {
        setTimeout(() => {
          const targetCell = document.querySelector(`#gradebook-table-body td[data-student-id="${targetStudentId}"][data-key="${targetKey}"]`);
          if (targetCell) {
            targetCell.click();
          }
        }, 120);
      }
    }

    function confirmDeleteStudent(studentId, subjectCode, studentName) {
      if (!confirm(`คุณครูยืนยันที่จะลบรายชื่อนักเรียน "${studentName}" (รหัส ${studentId}) ออกจากระบบสเปรดชีตใช่หรือไม่?\n*(การลบข้อมูลนี้จะไม่สามารถย้อนกลับได้)`)) {
        return;
      }

      const syncStatus = document.getElementById("sync-status");
      if (syncStatus) {
        syncStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบนักเรียน...';
        syncStatus.className = "text-warning";
      }

      const record = dbGrades.find(g => String(g.student_id).trim() === String(studentId).trim() && String(g.subject_code).trim() === String(subjectCode).trim());
      const targetSheet = record ? record._sheetName : activeSheetName;

      if (isGAS || getBackendURL()) {
        callBackendAPI("deleteStudent", { sheetName: targetSheet, studentId: studentId, subjectCode: subjectCode })
          .then(res => {
            if (res && res.status === "success") {
              showToast(`🗑️ ลบรายชื่อนักเรียน "${studentName}" สำเร็จ!`, "success");
              
              // Remove locally
              dbGrades = dbGrades.filter(g => !(String(g.student_id).trim() === String(studentId).trim() && String(g.subject_code).trim() === String(subjectCode).trim()));
              SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));

              if (syncStatus) {
                syncStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> ลบข้อมูลสำเร็จ';
                syncStatus.className = "text-success";
              }

              handleGradebookFilterChange();
            } else {
              showToast("❌ ลบนักเรียนล้มเหลว: " + (res ? res.message : "เกิดข้อผิดพลาด"), "danger");
              if (syncStatus) {
                syncStatus.innerHTML = '❌ ลบล้มเหลว';
                syncStatus.className = "text-danger";
              }
            }
          })
          .catch(err => {
            showToast("❌ การเชื่อมต่อล้มเหลว: " + err.message, "danger");
            if (syncStatus) {
              syncStatus.innerHTML = '❌ การเชื่อมต่อขัดข้อง';
              syncStatus.className = "text-danger";
            }
          });
      } else {
        // Local mode fallback
        dbGrades = dbGrades.filter(g => !(String(g.student_id).trim() === String(studentId).trim() && String(g.subject_code).trim() === String(subjectCode).trim()));
        SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
        showToast(`🗑️ [Local] ลบรายชื่อนักเรียน "${studentName}" สำเร็จ!`, "success");
        handleGradebookFilterChange();
      }
    }

    let activeEditingHeader = null;

    function makeHeaderEditable(headerElement, oldHeaderName) {
      if (activeEditingHeader) return;
      activeEditingHeader = headerElement;

      const originalVal = oldHeaderName;
      headerElement.innerHTML = "";

      const input = document.createElement("input");
      input.className = "cell-input";
      input.style.width = "90px";
      input.style.fontSize = "12px";
      input.style.textAlign = "center";
      input.value = originalVal;

      headerElement.appendChild(input);
      input.focus();
      input.select();

      const saveHeaderFn = () => {
        if (input.wasSaved) return;
        input.wasSaved = true;

        const newHeaderName = input.value.trim();
        activeEditingHeader = null;

        if (newHeaderName === "" || newHeaderName === originalVal) {
          headerElement.textContent = originalVal;
          return;
        }

        // Show loading status
        const syncStatus = document.getElementById("sync-status");
        syncStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเปลี่ยนชื่อคอลัมน์...';
        syncStatus.className = "text-warning";

        const selectedSubject = document.getElementById("gradebook-filter-subject").value;
        const targetSheetName = selectedSubject !== "all" ? selectedSubject : activeSheetName;

        if (isGAS || getBackendURL()) {
          callBackendAPI("renameColumn", { sheetName: targetSheetName, oldColumnName: originalVal, newColumnName: newHeaderName })
            .then(res => {
              if (res && res.status === "success") {
                showToast(`✅ เปลี่ยนชื่อหัวข้อเป็น "${newHeaderName}" สำเร็จ!`, "success");
                
                // Update local structures
                if (dbSheetHeadersMap[targetSheetName]) {
                  const idx = dbSheetHeadersMap[targetSheetName].indexOf(originalVal);
                  if (idx !== -1) {
                    dbSheetHeadersMap[targetSheetName][idx] = newHeaderName;
                  }
                }
                
                dbGrades.forEach(g => {
                  if (g._sheetName === targetSheetName) {
                    g[newHeaderName] = g[originalVal];
                    delete g[originalVal];
                  }
                });

                const allIdx = dbAllHeaders.indexOf(originalVal);
                if (allIdx !== -1) {
                  dbAllHeaders[allIdx] = newHeaderName;
                }
                
                SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
                SafeStorage.setItem("db_headers", JSON.stringify(dbAllHeaders));

                syncStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> เปลี่ยนชื่อสำเร็จ';
                syncStatus.className = "text-success";
                
                handleGradebookFilterChange();
              } else {
                showToast("❌ เปลี่ยนชื่อคอลัมน์ล้มเหลว: " + (res ? res.message : "เกิดข้อผิดพลาด"), "danger");
                headerElement.textContent = originalVal;
                syncStatus.innerHTML = '❌ เปลี่ยนชื่อล้มเหลว';
                syncStatus.className = "text-danger";
              }
            })
            .catch(err => {
              showToast("❌ การเชื่อมต่อล้มเหลว: " + err.message, "danger");
              headerElement.textContent = originalVal;
              syncStatus.innerHTML = '❌ การเชื่อมต่อขัดข้อง';
              syncStatus.className = "text-danger";
            });
        } else {
          // Local fallback mode
          if (dbSheetHeadersMap[targetSheetName]) {
            const idx = dbSheetHeadersMap[targetSheetName].indexOf(originalVal);
            if (idx !== -1) {
              dbSheetHeadersMap[targetSheetName][idx] = newHeaderName;
            }
          }
          dbGrades.forEach(g => {
            if (g._sheetName === targetSheetName) {
              g[newHeaderName] = g[originalVal];
              delete g[originalVal];
            }
          });
          const allIdx = dbAllHeaders.indexOf(originalVal);
          if (allIdx !== -1) {
            dbAllHeaders[allIdx] = newHeaderName;
          }
          SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
          SafeStorage.setItem("db_headers", JSON.stringify(dbAllHeaders));

          showToast(`✅ [Local] เปลี่ยนชื่อหัวข้อเป็น "${newHeaderName}"`, "success");
          handleGradebookFilterChange();
        }
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveHeaderFn();
        } else if (e.key === "Escape") {
          headerElement.textContent = originalVal;
          activeEditingHeader = null;
        }
      });

      input.addEventListener("blur", saveHeaderFn);
    }

    function makeCellEditable(cellElement, studentId, subjectCode, key, typeOrMax) {
      if (activeEditingCell) return; // Only edit one cell at a time
      
      activeEditingCell = cellElement;
      const originalVal = cellElement.textContent.trim() === "-" ? "" : cellElement.textContent.trim();
      
      cellElement.innerHTML = "";
      const input = document.createElement("input");
      input.className = "cell-input";
      input.value = originalVal;
      
      if (typeOrMax === 'text') {
        input.type = "text";
        input.style.textAlign = key === 'name' ? "left" : "center";
        if (key === 'comment') {
          input.setAttribute("list", "quick-comments");
        }
      } else if (typeOrMax === 'number-free') {
        input.type = "number";
        input.min = 1;
        input.style.textAlign = "center";
      } else {
        input.type = "number";
        input.min = 0;
        input.max = typeOrMax;
        input.step = 0.5;
      }
      
      cellElement.appendChild(input);
      input.focus();
      input.select();

      // Save handlers
      const saveFn = () => {
        if (input.wasSaved) return;
        input.wasSaved = true;
        
        let newVal = input.value.trim();
        
        if (typeOrMax !== 'text' && typeOrMax !== 'number-free') {
          if (newVal === "") {
            newVal = "";
          } else {
            newVal = Math.min(typeOrMax, Math.max(0, parseFloat(newVal) || 0));
          }
        } else if (typeOrMax === 'number-free') {
          if (newVal === "") {
            newVal = "";
          } else {
            newVal = Math.max(1, parseInt(newVal) || 1);
          }
        }

        // Apply changes locally immediately
        const record = dbGrades.find(g => String(g.student_id).trim() === String(studentId).trim() && String(g.subject_code).trim() === String(subjectCode).trim());
        const targetSheet = record ? record._sheetName : activeSheetName;
        if (record) {
          record[key] = newVal;
          SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
        }

        // Render back cell value
        cellElement.textContent = newVal === "" ? "-" : newVal;
        activeEditingCell = null;
        
        // Push update to Apps Script or save to Local
        updateScoresOnSheets(studentId, subjectCode, key, newVal, targetSheet);
        
        // Re-calc grid averages
        handleGradebookFilterChange();
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveFn();
          navigateAndEdit(studentId, key, "down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          saveFn();
          navigateAndEdit(studentId, key, e.shiftKey ? "left" : "right");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          saveFn();
          navigateAndEdit(studentId, key, "down");
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          saveFn();
          navigateAndEdit(studentId, key, "up");
        } else if (e.key === "Escape") {
          cellElement.textContent = originalVal === "" ? "-" : originalVal;
          activeEditingCell = null;
        }
      });

      input.addEventListener("blur", saveFn);
    }

    function updateScoresOnSheets(studentId, subjectCode, key, newVal, targetSheetFromParam = null) {
      const syncStatus = document.getElementById("sync-status");
      syncStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกลงชีท...';
      syncStatus.className = "text-warning";

      const scores = {};
      scores[key] = newVal;

      // ค้นหาชีทปลายทางของแถวนักเรียนนี้
      let targetSheet = targetSheetFromParam;
      if (!targetSheet) {
        const record = dbGrades.find(g => String(g.student_id).trim() === String(studentId).trim() && String(g.subject_code).trim() === String(subjectCode).trim());
        targetSheet = record ? record._sheetName : activeSheetName;
      }

      if (isGAS || getBackendURL()) {
        callBackendAPI("updateScores", { sheetName: targetSheet, studentId: studentId, subjectCode: subjectCode, scores: scores })
          .then(res => {
            if (res && res.status === "success") {
              syncStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> บันทึกลง Google Sheets แล้ว';
              syncStatus.className = "text-success";
            } else {
              syncStatus.innerHTML = '❌ บันทึกล้มเหลว (ลองแก้ไขใหม่)';
              syncStatus.className = "text-danger";
              showToast("❌ ไม่สามารถบันทึกลงชีทได้: " + res.message, "danger");
            }
          })
          .catch(err => {
            syncStatus.innerHTML = '❌ การเชื่อมต่อชีทขัดข้อง';
            syncStatus.className = "text-danger";
            showToast("❌ เชื่อมต่อล้มเหลว: " + err.message, "danger");
          });
      } else {
        setTimeout(() => {
          syncStatus.innerHTML = '<i class="fa-solid fa-check-circle"></i> บันทึกลงบราว์เซอร์โลคอลแล้ว';
          syncStatus.className = "text-success";
        }, 300);
      }
    }

    // Open & populate Add Student Modal
    function openAddStudentModal() {
      const select = document.getElementById("new-student-sheet");
      if (!select) return;
      
      select.innerHTML = "";
      dbSheetNames.forEach(sheet => {
        const opt = document.createElement("option");
        opt.value = sheet;
        opt.textContent = sheet;
        select.appendChild(opt);
      });
      
      switchAddStudentMode('single'); // ตั้งต้นที่โหมดกรอกรายคน
      openModal("add-student-modal");
    }

    // Modal Actions: Add student
    function handleAddStudent(e) {
      e.preventDefault();
      const targetSheet = document.getElementById("new-student-sheet").value;
      const studentId = document.getElementById("new-student-id").value.trim();
      const name = document.getElementById("new-student-name").value.trim();
      const classroom = document.getElementById("new-student-classroom").value.trim();
      const studentNo = document.getElementById("new-student-no").value.trim();
      const subjectCode = document.getElementById("new-student-subject-code").value.trim();
      const subjectName = document.getElementById("new-student-subject-name").value.trim();

      const studentData = {
        student_id: studentId,
        name: name,
        classroom: classroom,
        student_no: studentNo,
        subject_code: subjectCode,
        subject_name: subjectName,
        midterm_score: "",
        final_score: "",
        comment: "",
        scores: {}
      };

      showToast("👤 กำลังเพิ่มรายชื่อนักเรียน...", "info");

      if (isGAS || getBackendURL()) {
        callBackendAPI("addStudent", { sheetName: targetSheet, studentData: studentData })
          .then(res => {
            if (res && res.status === "success") {
              showToast("✅ เพิ่มข้อมูลสำเร็จ กำลังดึงข้อมูลตารางใหม่...", "success");
              closeModal("add-student-modal");
              syncTeacherGrades();
            } else {
              showToast("❌ เพิ่มข้อมูลไม่สำเร็จ: " + res.message, "danger");
            }
          })
          .catch(err => {
            showToast("❌ ข้อผิดพลาดเซิร์ฟเวอร์: " + err.message, "danger");
          });
      } else {
        // Local simulation add
        studentData["_sheetName"] = targetSheet;
        dbGrades.push(studentData);
        SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
        syncTeacherGrades();
        closeModal("add-student-modal");
        showToast("✅ เพิ่มข้อมูลนักเรียนเรียบร้อยแล้ว (ออฟไลน์)", "success");
      }
    }

    // สลับโหมดการนำเข้านักเรียน (เพิ่มรายคน vs นำเข้าหลายคน)
    function switchAddStudentMode(mode) {
      const singleBtn = document.getElementById("btn-add-single");
      const bulkBtn = document.getElementById("btn-add-bulk");
      const singlePanel = document.getElementById("add-student-single-panel");
      const bulkPanel = document.getElementById("add-student-bulk-panel");
      
      if (mode === "single") {
        singleBtn.style.color = "var(--primary)";
        singleBtn.style.borderBottom = "3px solid var(--primary)";
        singleBtn.style.fontWeight = "600";
        
        bulkBtn.style.color = "var(--text-muted)";
        bulkBtn.style.borderBottom = "none";
        bulkBtn.style.fontWeight = "500";
        
        singlePanel.classList.remove("d-none");
        bulkPanel.classList.add("d-none");
      } else {
        bulkBtn.style.color = "var(--primary)";
        bulkBtn.style.borderBottom = "3px solid var(--primary)";
        bulkBtn.style.fontWeight = "600";
        
        singleBtn.style.color = "var(--text-muted)";
        singleBtn.style.borderBottom = "none";
        singleBtn.style.fontWeight = "500";
        
        bulkPanel.classList.remove("d-none");
        singlePanel.classList.add("d-none");
        
        document.getElementById("bulk-student-input").value = "";
        document.getElementById("bulk-preview-count").textContent = "ตรวจพบนักเรียนทั้งหมด: 0 คน";
      }
    }

    // ฟังก์ชันช่วยแยกคอลัมน์ (Parser) ข้อมูลจาก Excel/CSV
    function parseBulkStudentInput(text) {
      if (!text.trim()) return [];
      const lines = text.split("\n");
      const parsed = [];
      
      lines.forEach(line => {
        if (!line.trim()) return;
        
        // คั่นด้วย Tab หรือเครื่องหมาย Comma (จุลภาค)
        let parts = line.split("\t");
        if (parts.length < 2) {
          parts = line.split(",");
        }
        
        parts = parts.map(p => p.trim());
        
        if (parts.length >= 6) {
          parsed.push({
            student_id: parts[0],
            name: parts[1],
            classroom: parts[2],
            student_no: parts[3],
            subject_code: parts[4],
            subject_name: parts[5]
          });
        }
      });
      return parsed;
    }

    // อัปเดตการแสดงผลนับจำนวนนักเรียนขณะพิมพ์หรือวางรายชื่อ
    function handleBulkInputUpdate() {
      const inputVal = document.getElementById("bulk-student-input").value;
      const students = parseBulkStudentInput(inputVal);
      document.getElementById("bulk-preview-count").textContent = `ตรวจพบนักเรียนทั้งหมด: ${students.length} คน`;
    }

    // บันทึกการนำข้อมูลเข้าแบบกลุ่ม
    function handleBulkImportSubmit(e) {
      e.preventDefault();
      const inputVal = document.getElementById("bulk-student-input").value.trim();
      const studentsList = parseBulkStudentInput(inputVal);
      
      if (studentsList.length === 0) {
        showToast("⚠️ ไม่พบข้อมูลนักเรียนที่ถูกต้องตามรูปแบบคอลัมน์", "warning");
        return;
      }
      
      showToast(`📤 กำลังนำเข้ารายชื่อนักเรียน ${studentsList.length} คน...`, "info");
      
      if (isGAS || getBackendURL()) {
        callBackendAPI("addStudentsBulk", { studentsList: studentsList })
          .then(res => {
            let msg = `✅ นำเข้าสำเร็จ (เพิ่มใหม่: ${res.added !== undefined ? res.added : studentsList.length} คน)`;
            if (res.createdSheets && res.createdSheets.length > 0) {
              msg += ` สร้างชีทวิชาใหม่ ${res.createdSheets.length} แท็บ`;
            }
            showToast(msg, "success");
            closeModal("add-student-modal");
            syncTeacherGrades();
          })
          .catch(err => {
            showToast("❌ ข้อผิดพลาดการซิงค์: " + err.message, "danger");
          });
      } else {
        // จำลองการอัปเดตแบบออฟไลน์ (Local simulation)
        let addedLocal = 0;
        let updatedLocal = 0;
        let createdSheetsLocal = [];
        
        studentsList.forEach(newStudent => {
          const targetSheet = newStudent.classroom + "_" + newStudent.subject_name;
          
          // สร้างแผ่นงานใหม่หากไม่มีอยู่เดิม
          if (!dbSheetNames.includes(targetSheet)) {
            dbSheetNames.push(targetSheet);
            createdSheetsLocal.push(targetSheet);
            dbSheetHeadersMap[targetSheet] = [...DEFAULT_HEADERS];
          }
          
          // ค้นหาแถวซ้ำ
          const existing = dbGrades.find(g => 
            String(g.student_id).trim() === String(newStudent.student_id).trim() && 
            String(g.subject_code).trim() === String(newStudent.subject_code).trim()
          );
          
          if (existing) {
            existing.name = newStudent.name;
            existing.classroom = newStudent.classroom;
            existing.student_no = Number(newStudent.student_no) || 0;
            existing.subject_code = newStudent.subject_code;
            existing.subject_name = newStudent.subject_name;
            updatedLocal++;
          } else {
            const studentData = {
              student_id: newStudent.student_id,
              name: newStudent.name,
              classroom: newStudent.classroom,
              student_no: Number(newStudent.student_no) || 0,
              subject_code: newStudent.subject_code,
              subject_name: newStudent.subject_name,
              midterm_score: "",
              final_score: "",
              comment: "",
              _sheetName: targetSheet
            };
            
            // ใส่คีย์คะแนนเก็บย่อยเพิ่มเติม
            dbSheetHeadersMap[targetSheet].forEach(h => {
              const fixed = ["student_id", "name", "classroom", "student_no", "subject_code", "subject_name", "midterm_score", "final_score", "comment"];
              if (!fixed.includes(h)) {
                studentData[h] = "";
              }
            });
            
            dbGrades.push(studentData);
            addedLocal++;
          }
        });
        
        SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
        SafeStorage.setItem("db_sheet_names", JSON.stringify(dbSheetNames));
        
        rebuildLocalDropdowns();
        syncTeacherGrades();
        closeModal("add-student-modal");
        
        let msg = `✅ นำเข้าข้อมูลสำเร็จ (เพิ่มใหม่: ${addedLocal} คน, อัปเดตซ้ำ: ${updatedLocal} คน)`;
        if (createdSheetsLocal.length > 0) {
          msg += ` สร้างห้องใหม่ ${createdSheetsLocal.length} แท็บ`;
        }
        showToast(msg, "success");
      }
    }


    // Open & populate Add Column Modal
    function openAddColumnModal() {
      const select = document.getElementById("new-col-sheet");
      if (!select) return;
      
      select.innerHTML = "";
      dbSheetNames.forEach(sheet => {
        const opt = document.createElement("option");
        opt.value = sheet;
        opt.textContent = sheet;
        select.appendChild(opt);
      });
      
      openModal("add-column-modal");
    }

    // Modal Actions: Add column
    function handleAddColumn(e) {
      e.preventDefault();
      const targetSheet = document.getElementById("new-col-sheet").value;
      const columnName = document.getElementById("new-col-name").value.trim();

      if (!columnName.includes("(") || !columnName.includes(")")) {
        alert("⚠️ กรุณาใส่วงเล็บคะแนนเต็มต่อท้ายชื่อชิ้นงานด้วย\nเช่น: ใบงาน 3 (10)");
        return;
      }

      showToast("➕ กำลังเพิ่มคอลัมน์คะแนนใหม่...", "info");

      if (isGAS || getBackendURL()) {
        callBackendAPI("addColumn", { sheetName: targetSheet, columnName: columnName })
          .then(res => {
            if (res && res.status === "success") {
              showToast("✅ เพิ่มคอลัมน์สำเร็จ กำลังดึงตารางใหม่...", "success");
              closeModal("add-column-modal");
              syncTeacherGrades();
            } else {
              showToast("❌ เพิ่มคอลัมน์ล้มเหลว: " + res.message, "danger");
            }
          })
          .catch(err => {
            showToast("❌ เซิร์ฟเวอร์ล้มเหลว: " + err.message, "danger");
          });
      } else {
        // Local simulation add
        dbHeaders.splice(dbHeaders.length - 1, 0, columnName);
        dbGrades.forEach(st => {
          if (st["_sheetName"] === targetSheet) {
            st[columnName] = "";
          }
        });
        
        if (!dbSheetHeadersMap[targetSheet]) {
          dbSheetHeadersMap[targetSheet] = [...DEFAULT_HEADERS];
        }
        dbSheetHeadersMap[targetSheet].splice(dbSheetHeadersMap[targetSheet].length - 1, 0, columnName);
        
        SafeStorage.setItem("db_headers", JSON.stringify(dbHeaders));
        SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
        
        syncTeacherGrades();
        closeModal("add-column-modal");
        showToast("✅ เพิ่มคอลัมน์เรียบร้อยแล้ว (ออฟไลน์)", "success");
      }
    }

    // Populate & Open Delete Column Modal
    function openDeleteColumnModal() {
      const sheetSelect = document.getElementById("delete-col-sheet");
      if (!sheetSelect) return;
      
      sheetSelect.innerHTML = "";
      dbSheetNames.forEach(sheet => {
        const opt = document.createElement("option");
        opt.value = sheet;
        opt.textContent = sheet;
        sheetSelect.appendChild(opt);
      });
      
      if (dbSheetNames.length > 0) {
        populateDeleteColDropdown(dbSheetNames[0]);
      }
      openModal("delete-column-modal");
    }

    function populateDeleteColDropdown(sheetName) {
      const select = document.getElementById("delete-col-select");
      if (!select) return;
      
      const headers = dbSheetHeadersMap[sheetName] || dbHeaders;
      const scoreHeaders = getScoreHeaders(headers);
      select.innerHTML = "";
      
      if (scoreHeaders.length === 0) {
        select.innerHTML = '<option value="" disabled selected>-- ไม่มีคอลัมน์คะแนนย่อยให้ลบ --</option>';
      } else {
        scoreHeaders.forEach(sh => {
          const opt = document.createElement("option");
          opt.value = sh;
          opt.textContent = sh;
          select.appendChild(opt);
        });
      }
    }

    // Handle Delete Column Action
    function handleDeleteColumn(e) {
      e.preventDefault();
      const targetSheet = document.getElementById("delete-col-sheet").value;
      const columnName = document.getElementById("delete-col-select").value;

      if (!columnName) {
        showToast("⚠️ ไม่มีคอลัมน์ให้ลบ", "warning");
        return;
      }

      if (!confirm(`คุณครูแน่ใจหรือไม่ว่าต้องการลบคอลัมน์ "${columnName}" ใช่หรือไม่?\nข้อมูลคะแนนในคอลัมน์นี้ของนักเรียนทุกคนจะหายไปถาวร!`)) {
        return;
      }

      showToast("🗑️ กำลังลบคอลัมน์คะแนน...", "info");

      if (isGAS || getBackendURL()) {
        callBackendAPI("deleteColumn", { sheetName: targetSheet, columnName: columnName })
          .then(res => {
            if (res && res.status === "success") {
              showToast("✅ ลบคอลัมน์เรียบร้อย กำลังซิงค์ข้อมูลใหม่...", "success");
              closeModal("delete-column-modal");
              syncTeacherGrades();
            } else {
              showToast("❌ ลบคอลัมน์ล้มเหลว: " + res.message, "danger");
            }
          })
          .catch(err => {
            showToast("❌ เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์: " + err.message, "danger");
          });
      } else {
        // Local simulation delete
        if (dbSheetHeadersMap[targetSheet]) {
          const idx = dbSheetHeadersMap[targetSheet].indexOf(columnName);
          if (idx !== -1) {
            dbSheetHeadersMap[targetSheet].splice(idx, 1);
          }
        }
        
        dbGrades.forEach(st => {
          if (st["_sheetName"] === targetSheet) {
            delete st[columnName];
          }
        });
        
        SafeStorage.setItem("db_grades", JSON.stringify(dbGrades));
        syncTeacherGrades();
        closeModal("delete-column-modal");
        showToast("✅ ลบคอลัมน์ตัวอย่างเรียบร้อยแล้ว (ออฟไลน์)", "success");
      }
    }

    // -------------------------------------------------------------
    // WINDOW UTILITIES & TOASTS
    // -------------------------------------------------------------
    function openModal(id) {
      document.getElementById(id).classList.add("active");
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove("active");
    }

    function showToast(msg, type = "success") {
      const container = document.getElementById("toast-wrapper");
      const toast = document.createElement("div");
      toast.className = 'toast toast-' + type;
      
      let icon = '<i class="fa-solid fa-circle-check"></i>';
      if (type === "warning") icon = '<i class="fa-solid fa-circle-exclamation"></i>';
      if (type === "danger") icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
      if (type === "info") icon = '<i class="fa-solid fa-circle-info"></i>';

      toast.innerHTML = `${icon} <span>${msg}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = 0;
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    let lastReportData = null;

    function renderTeacherSummaryReport() {
      const gradeTbody = document.getElementById("report-grade-tbody");
      const evalTbody = document.getElementById("report-eval-tbody");
      
      const gradeTotalRow = document.getElementById("report-grade-total-row");
      const gradePercentageRow = document.getElementById("report-grade-percentage-row");
      const evalTotalRow = document.getElementById("report-eval-total-row");
      const evalPercentageRow = document.getElementById("report-eval-percentage-row");

      if (!gradeTbody || !evalTbody) return;

      gradeTbody.innerHTML = "";
      evalTbody.innerHTML = "";

      if (dbSheetNames.length === 0) {
        gradeTbody.innerHTML = `<tr><td colspan="13" style="padding:20px; color:var(--text-muted);">ไม่พบข้อมูลแผ่นงานวิชาใดๆ</td></tr>`;
        evalTbody.innerHTML = `<tr><td colspan="12" style="padding:20px; color:var(--text-muted);">ไม่พบข้อมูลแผ่นงานวิชาใดๆ</td></tr>`;
        lastReportData = null;
        return;
      }

      // Load custom subject names
      let customNames = {};
      if (typeof dbCustomSubjectNames === "object") {
        customNames = Object.assign({}, dbCustomSubjectNames);
      }
      try {
        const stored = SafeStorage.getItem("custom_subject_names");
        if (stored) {
          const localStored = JSON.parse(stored);
          Object.keys(localStored).forEach(key => {
            if (!customNames[key]) {
              customNames[key] = localStored[key];
            }
          });
        }
      } catch (e) {}

      // Overall sums
      let grandTotalStudents = 0;
      const grandGradeCounts = { "4": 0, "3.5": 0, "3": 0, "2.5": 0, "2": 0, "1.5": 0, "1": 0, "0": 0, "ร": 0, "มส": 0 };
      const grandEvalReadingCounts = { "3": 0, "2": 0, "1": 0, "0": 0 };
      const grandEvalCharacterCounts = { "3": 0, "2": 0, "1": 0, "0": 0 };

      const gradeRowsArray = [];
      const evalRowsArray = [];

      dbSheetNames.forEach((sheetName, index) => {
        const students = dbGrades.filter(st => st._sheetName === sheetName);
        const totalStudents = students.length;
        grandTotalStudents += totalStudents;

        // 1. Resolve Subject Name
        let displayName = customNames[sheetName];
        if (!displayName) {
          // Try to build default: "CODE รายวิชาNAME"
          if (totalStudents > 0) {
            const first = students[0];
            if (first.subject_code && first.subject_name) {
              displayName = `${first.subject_code} รายวิชา${first.subject_name}`;
            }
          }
          if (!displayName) displayName = sheetName;
        }

        // 2. Count grades
        const gradeCounts = { "4": 0, "3.5": 0, "3": 0, "2.5": 0, "2": 0, "1.5": 0, "1": 0, "0": 0, "ร": 0, "มส": 0 };
        const headers = dbSheetHeadersMap[sheetName] || dbHeaders;

        students.forEach(st => {
          const isR = String(st.midterm_score).trim() === "ร" || String(st.final_score).trim() === "ร";
          const isMS = String(st.midterm_score).trim() === "มส" || String(st.final_score).trim() === "มส";

          if (isR) {
            gradeCounts["ร"]++;
            grandGradeCounts["ร"]++;
          } else if (isMS) {
            gradeCounts["มส"]++;
            grandGradeCounts["มส"]++;
          } else {
            const calc = calculateScoresAndGrades(st, headers);
            const g = String(calc.grade);
            if (gradeCounts.hasOwnProperty(g)) {
              gradeCounts[g]++;
              grandGradeCounts[g]++;
            } else {
              gradeCounts["0"]++;
              grandGradeCounts["0"]++;
            }
          }
        });

        // 3. Count Reading and Character evaluations based on grade mapping:
        // 3 = grade 4, 3.5, 3
        // 2 = grade 2.5, 2, 1.5, 1
        // 1 = grade 0, ร, มส
        const evalReadingCounts = { "3": 0, "2": 0, "1": 0, "0": 0 };
        const evalCharacterCounts = { "3": 0, "2": 0, "1": 0, "0": 0 };

        students.forEach(st => {
          const isR = String(st.midterm_score).trim() === "ร" || String(st.final_score).trim() === "ร";
          const isMS = String(st.midterm_score).trim() === "มส" || String(st.final_score).trim() === "มส";
          
          let evalVal = "1"; // Default for 0, ร, มส
          
          if (!isR && !isMS) {
            const calc = calculateScoresAndGrades(st, headers);
            const g = Number(calc.grade); // 4, 3.5, 3, 2.5, 2, 1.5, 1, 0
            if (g >= 3) {
              evalVal = "3";
            } else if (g >= 1) {
              evalVal = "2";
            } else {
              evalVal = "1";
            }
          }
          
          evalReadingCounts[evalVal]++;
          grandEvalReadingCounts[evalVal]++;
          
          evalCharacterCounts[evalVal]++;
          grandEvalCharacterCounts[evalVal]++;
        });

        // Add to rows array
        gradeRowsArray.push({
          no: index + 1,
          subject: displayName,
          total: totalStudents,
          g4: gradeCounts["4"],
          g3_5: gradeCounts["3.5"],
          g3: gradeCounts["3"],
          g2_5: gradeCounts["2.5"],
          g2: gradeCounts["2"],
          g1_5: gradeCounts["1.5"],
          g1: gradeCounts["1"],
          g0: gradeCounts["0"],
          gR: gradeCounts["ร"],
          gMS: gradeCounts["มส"]
        });

        evalRowsArray.push({
          no: index + 1,
          subject: displayName,
          total: totalStudents,
          r3: evalReadingCounts["3"],
          r2: evalReadingCounts["2"],
          r1: evalReadingCounts["1"],
          r0: evalReadingCounts["0"],
          c3: evalCharacterCounts["3"],
          c2: evalCharacterCounts["2"],
          c1: evalCharacterCounts["1"],
          c0: evalCharacterCounts["0"],
          note: ""
        });

        // Render Table 1 row
        const tr1 = document.createElement("tr");
        tr1.innerHTML = `
          <td>${index + 1}</td>
          <td class="text-left"><span class="report-editable-subject" onclick="editReportSubject('${sheetName}')" title="คลิกเพื่อแก้ไขชื่อวิชา">${displayName}</span></td>
          <td>${totalStudents}</td>
          <td>${gradeCounts["4"] || "-"}</td>
          <td>${gradeCounts["3.5"] || "-"}</td>
          <td>${gradeCounts["3"] || "-"}</td>
          <td>${gradeCounts["2.5"] || "-"}</td>
          <td>${gradeCounts["2"] || "-"}</td>
          <td>${gradeCounts["1.5"] || "-"}</td>
          <td>${gradeCounts["1"] || "-"}</td>
          <td>${gradeCounts["0"] || "-"}</td>
          <td>${gradeCounts["ร"] || "-"}</td>
          <td>${gradeCounts["มส"] || "-"}</td>
        `;
        gradeTbody.appendChild(tr1);

        // Render Table 2 row
        const tr2 = document.createElement("tr");
        tr2.innerHTML = `
          <td>${index + 1}</td>
          <td class="text-left"><span class="report-editable-subject" onclick="editReportSubject('${sheetName}')" title="คลิกเพื่อแก้ไขชื่อวิชา">${displayName}</span></td>
          <td>${totalStudents}</td>
          <td>${evalReadingCounts["3"] || "-"}</td>
          <td>${evalReadingCounts["2"] || "-"}</td>
          <td>${evalReadingCounts["1"] || "-"}</td>
          <td>${evalReadingCounts["0"] || "-"}</td>
          <td>${evalCharacterCounts["3"] || "-"}</td>
          <td>${evalCharacterCounts["2"] || "-"}</td>
          <td>${evalCharacterCounts["1"] || "-"}</td>
          <td>${evalCharacterCounts["0"] || "-"}</td>
          <td></td>
        `;
        evalTbody.appendChild(tr2);
      });

      // Render Table 1 totals
      gradeTotalRow.innerHTML = `
        <td colspan="2">รวม</td>
        <td>${grandTotalStudents}</td>
        <td>${grandGradeCounts["4"] || "-"}</td>
        <td>${grandGradeCounts["3.5"] || "-"}</td>
        <td>${grandGradeCounts["3"] || "-"}</td>
        <td>${grandGradeCounts["2.5"] || "-"}</td>
        <td>${grandGradeCounts["2"] || "-"}</td>
        <td>${grandGradeCounts["1.5"] || "-"}</td>
        <td>${grandGradeCounts["1"] || "-"}</td>
        <td>${grandGradeCounts["0"] || "-"}</td>
        <td>${grandGradeCounts["ร"] || "-"}</td>
        <td>${grandGradeCounts["มส"] || "-"}</td>
      `;

      // Render Table 1 percentages
      const pctGrade4 = grandTotalStudents > 0 ? ((grandGradeCounts["4"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGrade3_5 = grandTotalStudents > 0 ? ((grandGradeCounts["3.5"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGrade3 = grandTotalStudents > 0 ? ((grandEvalReadingCounts["3"] ? (grandGradeCounts["3"] / grandTotalStudents) : (grandGradeCounts["3"] / grandTotalStudents)) * 100).toFixed(2) : "0.00"; // just standard math
      const pctGrade2_5 = grandTotalStudents > 0 ? ((grandGradeCounts["2.5"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGrade2 = grandTotalStudents > 0 ? ((grandGradeCounts["2"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGrade1_5 = grandTotalStudents > 0 ? ((grandGradeCounts["1.5"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGrade1 = grandTotalStudents > 0 ? ((grandGradeCounts["1"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGrade0 = grandTotalStudents > 0 ? ((grandGradeCounts["0"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGradeR = grandTotalStudents > 0 ? ((grandGradeCounts["ร"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctGradeMS = grandTotalStudents > 0 ? ((grandGradeCounts["มส"] / grandTotalStudents) * 100).toFixed(2) : "0.00";

      gradePercentageRow.innerHTML = `
        <td colspan="2">ร้อยละ</td>
        <td>100</td>
        <td>${pctGrade4 !== "0.00" ? pctGrade4 : "-"}</td>
        <td>${pctGrade3_5 !== "0.00" ? pctGrade3_5 : "-"}</td>
        <td>${pctGrade3 !== "0.00" ? pctGrade3 : "-"}</td>
        <td>${pctGrade2_5 !== "0.00" ? pctGrade2_5 : "-"}</td>
        <td>${pctGrade2 !== "0.00" ? pctGrade2 : "-"}</td>
        <td>${pctGrade1_5 !== "0.00" ? pctGrade1_5 : "-"}</td>
        <td>${pctGrade1 !== "0.00" ? pctGrade1 : "-"}</td>
        <td>${pctGrade0 !== "0.00" ? pctGrade0 : "-"}</td>
        <td>${pctGradeR !== "0.00" ? pctGradeR : "-"}</td>
        <td>${pctGradeMS !== "0.00" ? pctGradeMS : "-"}</td>
      `;

      // Render 2.5+ Quality Assessment summary row
      const grandGte25Count = (grandGradeCounts["4"] || 0) + (grandGradeCounts["3.5"] || 0) + (grandGradeCounts["3"] || 0) + (grandGradeCounts["2.5"] || 0);
      const grandGte25Pct = grandTotalStudents > 0 ? ((grandGte25Count / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const gte25Row = document.getElementById("report-grade-gte25-row");
      if (gte25Row) {
        gte25Row.innerHTML = `
          <td colspan="3" class="text-left font-bold" style="padding: 10px 14px; color: #047857;">
            <i class="fa-solid fa-award"></i> ผู้เรียนที่มีผลการเรียนระดับ 2.5 ขึ้นไป (เกรด 2.5 - 4.0)
          </td>
          <td colspan="10" style="text-align: right; padding: 10px 18px; color: #047857;">
            <span style="font-size: 13.5px;">จำนวน <strong>${grandGte25Count}</strong> คน</span>
            <span style="margin-left: 15px; font-size: 14px; background: rgba(16, 185, 129, 0.2); padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
              คิดเป็น <strong>${grandGte25Pct}%</strong>
            </span>
          </td>
        `;
      }

      // Render Table 2 totals
      evalTotalRow.innerHTML = `
        <td colspan="2">รวม</td>
        <td>${grandTotalStudents}</td>
        <td>${grandEvalReadingCounts["3"] || "-"}</td>
        <td>${grandEvalReadingCounts["2"] || "-"}</td>
        <td>${grandEvalReadingCounts["1"] || "-"}</td>
        <td>${grandEvalReadingCounts["0"] || "-"}</td>
        <td>${grandEvalCharacterCounts["3"] || "-"}</td>
        <td>${grandEvalCharacterCounts["2"] || "-"}</td>
        <td>${grandEvalCharacterCounts["1"] || "-"}</td>
        <td>${grandEvalCharacterCounts["0"] || "-"}</td>
        <td></td>
      `;

      // Render Table 2 percentages
      const pctRead3 = grandTotalStudents > 0 ? ((grandEvalReadingCounts["3"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctRead2 = grandTotalStudents > 0 ? ((grandEvalReadingCounts["2"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctRead1 = grandTotalStudents > 0 ? ((grandEvalReadingCounts["1"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctRead0 = grandTotalStudents > 0 ? ((grandEvalReadingCounts["0"] / grandTotalStudents) * 100).toFixed(2) : "0.00";

      const pctChar3 = grandTotalStudents > 0 ? ((grandEvalCharacterCounts["3"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctChar2 = grandTotalStudents > 0 ? ((grandEvalCharacterCounts["2"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctChar1 = grandTotalStudents > 0 ? ((grandEvalCharacterCounts["1"] / grandTotalStudents) * 100).toFixed(2) : "0.00";
      const pctChar0 = grandTotalStudents > 0 ? ((grandEvalCharacterCounts["0"] / grandTotalStudents) * 100).toFixed(2) : "0.00";

      evalPercentageRow.innerHTML = `
        <td colspan="2">ร้อยละ</td>
        <td>100</td>
        <td>${pctRead3 !== "0.00" ? pctRead3 : "-"}</td>
        <td>${pctRead2 !== "0.00" ? pctRead2 : "-"}</td>
        <td>${pctRead1 !== "0.00" ? pctRead1 : "-"}</td>
        <td>${pctRead0 !== "0.00" ? pctRead0 : "-"}</td>
        <td>${pctChar3 !== "0.00" ? pctChar3 : "-"}</td>
        <td>${pctChar2 !== "0.00" ? pctChar2 : "-"}</td>
        <td>${pctChar1 !== "0.00" ? pctChar1 : "-"}</td>
        <td>${pctChar0 !== "0.00" ? pctChar0 : "-"}</td>
        <td></td>
      `;

      // Save to lastReportData for exporting
      lastReportData = {
        gradeRows: gradeRowsArray,
        evalRows: evalRowsArray,
        gradeTotals: { total: grandTotalStudents, g4: grandGradeCounts["4"], g3_5: grandGradeCounts["3.5"], g3: grandGradeCounts["3"], g2_5: grandGradeCounts["2.5"], g2: grandGradeCounts["2"], g1_5: grandGradeCounts["1.5"], g1: grandGradeCounts["1"], g0: grandGradeCounts["0"], gR: grandGradeCounts["ร"], gMS: grandGradeCounts["มส"], gte25Total: grandGte25Count, gte25Pct: grandGte25Pct },
        gradePcts: { total: 100, g4: pctGrade4 !== "0.00" ? pctGrade4 : "-", g3_5: pctGrade3_5 !== "0.00" ? pctGrade3_5 : "-", g3: pctGrade3 !== "0.00" ? pctGrade3 : "-", g2_5: pctGrade2_5 !== "0.00" ? pctGrade2_5 : "-", g2: pctGrade2 !== "0.00" ? pctGrade2 : "-", g1_5: pctGrade1_5 !== "0.00" ? pctGrade1_5 : "-", g1: pctGrade1 !== "0.00" ? pctGrade1 : "-", g0: pctGrade0 !== "0.00" ? pctGrade0 : "-", gR: pctGradeR !== "0.00" ? pctGradeR : "-", gMS: pctGradeMS !== "0.00" ? pctGradeMS : "-" },
        evalTotals: { total: grandTotalStudents, r3: grandEvalReadingCounts["3"], r2: grandEvalReadingCounts["2"], r1: grandEvalReadingCounts["1"], r0: grandEvalReadingCounts["0"], c3: grandEvalCharacterCounts["3"], c2: grandEvalCharacterCounts["2"], c1: grandEvalCharacterCounts["1"], c0: grandEvalCharacterCounts["0"] },
        evalPcts: { total: 100, r3: pctRead3 !== "0.00" ? pctRead3 : "-", r2: pctRead2 !== "0.00" ? pctRead2 : "-", r1: pctRead1 !== "0.00" ? pctRead1 : "-", r0: pctRead0 !== "0.00" ? pctRead0 : "-", c3: pctChar3 !== "0.00" ? pctChar3 : "-", c2: pctChar2 !== "0.00" ? pctChar2 : "-", c1: pctChar1 !== "0.00" ? pctChar1 : "-", c0: pctChar0 !== "0.00" ? pctChar0 : "-" }
      };
    }

    function editReportSubject(sheetName) {
      let defaultVal = dbCustomSubjectNames[sheetName];
      if (!defaultVal) {
        const students = dbGrades.filter(st => st._sheetName === sheetName);
        if (students.length > 0) {
          const first = students[0];
          if (first.subject_code && first.subject_name) {
            defaultVal = `${first.subject_code} รายวิชา${first.subject_name}`;
          }
        }
        if (!defaultVal) defaultVal = sheetName;
      }

      // Set input values and labels inside custom modal
      document.getElementById("edit-subject-sheet-name").value = sheetName;
      document.getElementById("edit-subject-sheet-label").textContent = `ชีตคะแนนต้นทาง: ${sheetName}`;
      document.getElementById("edit-subject-display-name").value = defaultVal;
      
      openModal("edit-subject-modal");
    }

    function handleEditSubjectSave(event) {
      event.preventDefault();
      const sheetName = document.getElementById("edit-subject-sheet-name").value;
      const trimmed = document.getElementById("edit-subject-display-name").value.trim();
      
      closeModal("edit-subject-modal");
      showToast("💾 กำลังบันทึกชื่อรายวิชาลงใน Google Sheets...", "info");
      
      if (isGAS || getBackendURL()) {
        callBackendAPI("saveCustomSubjectName", { sheetName: sheetName, customName: trimmed })
          .then(res => {
            if (res && res.status === "success") {
              showToast("✅ บันทึกชื่อวิชาลง Google Sheets สำเร็จ", "success");
              dbCustomSubjectNames[sheetName] = trimmed;
              
              // Backup to SafeStorage
              let localNames = {};
              try {
                const stored = SafeStorage.getItem("custom_subject_names");
                if (stored) localNames = JSON.parse(stored);
              } catch(e){}
              if (trimmed) {
                localNames[sheetName] = trimmed;
              } else {
                delete localNames[sheetName];
              }
              SafeStorage.setItem("custom_subject_names", JSON.stringify(localNames));
              
              renderTeacherSummaryReport();
            } else {
              showToast("❌ บันทึกล้มเหลว: " + res.message, "danger");
            }
          })
          .catch(err => {
            showToast("❌ เซิร์ฟเวอร์ล้มเหลว: " + err.message, "danger");
          });
      } else {
        dbCustomSubjectNames[sheetName] = trimmed;
        renderTeacherSummaryReport();
      }
    }

    function exportSummaryReportToSheets() {
      if (!lastReportData) {
        showToast("⚠️ ไม่พบข้อมูลรายงานที่จะบันทึก", "warning");
        return;
      }
      
      showToast("📤 กำลังบันทึกรายงานสรุปผลสัมฤทธิ์ไปยัง Google Sheets...", "info");
      
      if (isGAS || getBackendURL()) {
        callBackendAPI("saveSummaryReport", { reportData: JSON.stringify(lastReportData) })
          .then(res => {
            if (res && res.status === "success") {
              showToast("✅ บันทึกรายงานสรุปเป็นชีตใหม่สำเร็จ!", "success");
            } else {
              showToast("❌ บันทึกล้มเหลว: " + res.message, "danger");
            }
          })
          .catch(err => {
            showToast("❌ เซิร์ฟเวอร์ล้มเหลว: " + err.message, "danger");
          });
      } else {
        showToast("⚠️ โหมดจำลอง: บันทึกรายงานสรุปสำเร็จ (ไม่ได้เชื่อมต่อ Sheets จริง)", "warning");
      }
    }

    function getDefaultThaiDateString() {
      const now = new Date();
      const thaiMonths = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
      ];
      const d = now.getDate();
      const m = thaiMonths[now.getMonth()];
      const y = now.getFullYear() + 543;
      return `${d} / ${m} / ${y}`;
    }

    function formatThaiDateForPrint(raw) {
      if (!raw || !raw.trim()) {
        return "วันที่......../......../........";
      }
      const str = raw.trim();
      if (str.includes("/")) {
        const parts = str.split("/").map(p => p.trim()).filter(Boolean);
        if (parts.length === 3) {
          return `วันที่...${parts[0]}.../...${parts[1]}.../...${parts[2]}...`;
        }
      }
      const spaceParts = str.split(/\s+/).filter(Boolean);
      if (spaceParts.length === 3) {
        return `วันที่...${spaceParts[0]}.../...${spaceParts[1]}.../...${spaceParts[2]}...`;
      }
      return `วันที่...${str}...`;
    }

    function openPrintGradebookPreview() {
      const selectedClassroom = document.getElementById("gradebook-filter-classroom").value;
      const selectedSubject = document.getElementById("gradebook-filter-subject").value;

      if (selectedClassroom === "all" || selectedSubject === "all") {
        showToast("⚠️ กรุณาเลือกห้องเรียนและวิชาเฉพาะเจาะจงในตัวกรองก่อนสั่งพิมพ์", "warning");
        return;
      }

      // Load saved print details
      document.getElementById("print-opt-term").value = localStorage.getItem("print_term") || "1/2569";
      document.getElementById("print-opt-teacher").value = localStorage.getItem("print_teacher_name") || "นายสหัสวรรษ เหมือนมาศ";
      const savedDate = localStorage.getItem("print_date");
      document.getElementById("print-opt-date").value = savedDate !== null ? savedDate : getDefaultThaiDateString();

      updatePrintPreviewContent();
      openModal("print-gradebook-modal");
    }

    function updatePrintPreviewContent() {
      const classroom = document.getElementById("gradebook-filter-classroom").value;
      const subject = document.getElementById("gradebook-filter-subject").value;
      const term = document.getElementById("print-opt-term").value;
      const teacher = document.getElementById("print-opt-teacher").value;
      const dateVal = document.getElementById("print-opt-date") ? document.getElementById("print-opt-date").value : "";
      const displayDate = formatThaiDateForPrint(dateVal);

      const students = dbGrades.filter(st => st.classroom === classroom && st.subject_code === subject);
      if (students.length === 0) {
        document.getElementById("gradebook-print-page").innerHTML = "<div style='text-align:center; padding: 50px; color:#666;'>ไม่พบข้อมูลเกรดที่จะแสดงผลพิมพ์</div>";
        return;
      }

      // Sort by student number ascending
      students.sort((a, b) => {
        const noA = Number(a.student_no) || 999;
        const noB = Number(b.student_no) || 999;
        return noA - noB;
      });

      const firstStudent = students[0];
      const sheetName = firstStudent._sheetName;
      const activeHeaders = dbSheetHeadersMap[sheetName] || dbAllHeaders;
      const scoreHeaders = getScoreHeaders(activeHeaders);
      
      // Resolve custom subject name if any
      let subjectName = dbCustomSubjectNames[sheetName] || "";
      if (!subjectName && firstStudent.subject_name) {
        subjectName = firstStudent.subject_name;
      }
      if (!subjectName) subjectName = subject;

      // Calculate dynamic font size and padding based on number of columns to fit A4 perfectly
      const totalCols = 3 + scoreHeaders.length + 5; 
      let tableFontSize = "11px";
      let cellPadding = "7px 5px";
      
      if (totalCols > 15) {
        tableFontSize = "8px";
        cellPadding = "3px 2px";
      } else if (totalCols > 12) {
        tableFontSize = "9px";
        cellPadding = "4px 2px";
      } else if (totalCols > 9) {
        tableFontSize = "10px";
        cellPadding = "5px 3px";
      }

      let printCollectMax = 0;
      if (scoreHeaders.length > 0) {
        printCollectMax = scoreHeaders.reduce((sum, sh) => sum + parseMaxScore(sh), 0);
      }
      const printCollectTitle = printCollectMax > 0 ? `คะแนนเก็บรวม (${printCollectMax})` : "คะแนนเก็บรวม";

      // Build table headers with explicit column widths to prevent overflow
      let headersHtml = `
        <th style="width: 45px; min-width: 45px;">ลำดับ</th>
        <th style="width: 90px; min-width: 90px;">รหัสนักเรียน</th>
        <th style="text-align: left; padding-left: 10px; width: 220px; min-width: 180px;">ชื่อ - นามสกุล</th>
      `;
      scoreHeaders.forEach(sh => {
        headersHtml += `<th style="min-width: 60px; max-width: 150px; font-size: 0.9em; word-break: break-word; line-height: 1.2;">${sh}</th>`;
      });
      headersHtml += `
        <th style="width: 80px; min-width: 70px; font-size: 0.95em;">${printCollectTitle}</th>
        <th style="width: 80px; min-width: 70px; font-size: 0.95em;">กลางภาค (20)</th>
        <th style="width: 80px; min-width: 70px; font-size: 0.95em;">ปลายภาค (20)</th>
        <th style="width: 70px; min-width: 60px;">รวม 100</th>
        <th style="width: 60px; min-width: 50px;">เกรด</th>
      `;

      // Build table body
      let bodyHtml = "";
      students.forEach((st, idx) => {
        const calc = calculateScoresAndGrades(st, activeHeaders);
        
        let rowHtml = `
          <tr>
            <td>${idx + 1}</td>
            <td>${st.student_id}</td>
            <td class="text-left font-semibold" style="word-break: break-word;">${st.name}</td>
        `;

        scoreHeaders.forEach(sh => {
          rowHtml += `<td>${st[sh] !== undefined && st[sh] !== null && st[sh] !== "" ? st[sh] : "-"}</td>`;
        });

        rowHtml += `
            <td style="font-weight: 600;">${calc.collectTotal}</td>
            <td>${st.midterm_score !== undefined && st.midterm_score !== null && st.midterm_score !== "" ? st.midterm_score : "-"}</td>
            <td>${st.final_score !== undefined && st.final_score !== null && st.final_score !== "" ? st.final_score : "-"}</td>
            <td style="font-weight: bold;">${calc.totalScore}</td>
            <td style="font-weight: bold; color: #15803d;">${calc.grade}</td>
          </tr>
        `;
        bodyHtml += rowHtml;
      });

      // Assemble full print page HTML (with inline styles to enforce size and cell padding overrides)
      const printPageHtml = `
        <style>
          #gradebook-print-page .print-table th, 
          #gradebook-print-page .print-table td { 
            padding: ${cellPadding} !important; 
          }
        </style>

        <h2>แบบสรุปผลการเรียนและบันทึกคะแนนรายวิชา</h2>
        <h3>วิชา ${subjectName} (${subject})</h3>
        <p class="subtitle">ภาคเรียนที่ ${term} | ระดับชั้น ${classroom} | ครูผู้สอน: ${teacher}</p>

        <table class="print-table" style="font-size: ${tableFontSize} !important;">
          <thead>
            <tr>${headersHtml}</tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>

        <div class="print-footer">
          <div class="print-footer-col">
            ลงชื่อ...........................................................ครูผู้สอน<br>
            (${teacher})<br>
            ${displayDate}
          </div>
        </div>
      `;

      document.getElementById("gradebook-print-page").innerHTML = printPageHtml;
    }

    function triggerGradebookPrint() {
      const term = document.getElementById("print-opt-term").value;
      const teacher = document.getElementById("print-opt-teacher").value;
      const dateVal = document.getElementById("print-opt-date") ? document.getElementById("print-opt-date").value : "";
      localStorage.setItem("print_term", term);
      localStorage.setItem("print_teacher_name", teacher);
      localStorage.setItem("print_date", dateVal);

      window.print();
    }

    // ตรวจจับระบบการพิมพ์ของเบราว์เซอร์เพื่อจัดเตรียมหน้ากระดาษอย่างแม่นยำ
    window.addEventListener("beforeprint", () => {
      const modal = document.getElementById("print-gradebook-modal");
      if (modal && modal.classList.contains("active")) {
        document.body.classList.add("printing-gradebook");
      }
    });

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("printing-gradebook");
    });
