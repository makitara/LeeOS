;(() => {
      const DATA_FILE = "body-metrics-data.json";

      const CATEGORIES = [
        { id: "whole", label: "全身", color: "#5fa7de" },
        { id: "eyes", label: "眼部", color: "#6ab7c0" },
        { id: "blood", label: "血液", color: "#d96b83" },
        { id: "urine", label: "泌尿", color: "#c8aa5f" }
      ];

      const FIXED_METRICS = [
        { id: "height", category: "whole", label: "身高", short: "H", unit: "cm", type: "number", precision: 1, icon: "H", inputMin: 50, inputMax: 260 },
        { id: "weight", category: "whole", label: "体重", short: "W", unit: "kg", type: "number", precision: 1, icon: "W", inputMin: 10, inputMax: 400 },
        { id: "bmi", category: "whole", label: "BMI", short: "BMI", unit: "", type: "number", precision: 1, icon: "BMI", autoComputed: true, low: 18.5, high: 23.9 },
        { id: "sbp", category: "whole", label: "收缩压", short: "SYS", unit: "mmHg", type: "number", precision: 0, icon: "BP", inputMin: 50, inputMax: 260, low: 90, high: 140 },
        { id: "dbp", category: "whole", label: "舒张压", short: "DIA", unit: "mmHg", type: "number", precision: 0, icon: "BP", inputMin: 30, inputMax: 160, low: 60, high: 90 },

        { id: "dominant_eye", category: "eyes", label: "主视眼", short: "DOM", unit: "", type: "enum", icon: "DOM", options: [
          { value: "left", label: "左眼" },
          { value: "right", label: "右眼" }
        ] },
        { id: "vision_left", category: "eyes", label: "矫正视力(左)", short: "L-V", unit: "", type: "number", precision: 1, icon: "VIS", inputMin: 0, inputMax: 5 },
        { id: "vision_right", category: "eyes", label: "矫正视力(右)", short: "R-V", unit: "", type: "number", precision: 1, icon: "VIS", inputMin: 0, inputMax: 5 },
        { id: "left_sphere", category: "eyes", label: "左眼球镜", short: "L-SP", unit: "D", type: "number", precision: 2, icon: "SPH", inputMin: -30, inputMax: 30 },
        { id: "left_cylinder", category: "eyes", label: "左眼柱镜", short: "L-CY", unit: "D", type: "number", precision: 2, icon: "CYL", inputMin: -15, inputMax: 15 },
        { id: "left_axis", category: "eyes", label: "左眼轴位", short: "L-AX", unit: "°", type: "number", precision: 0, icon: "AX", inputMin: 0, inputMax: 180 },
        { id: "left_pupillary_distance", category: "eyes", label: "左瞳距", short: "L-PD", unit: "mm", type: "number", precision: 1, icon: "PD", inputMin: 20, inputMax: 45 },
        { id: "right_sphere", category: "eyes", label: "右眼球镜", short: "R-SP", unit: "D", type: "number", precision: 2, icon: "SPH", inputMin: -30, inputMax: 30 },
        { id: "right_cylinder", category: "eyes", label: "右眼柱镜", short: "R-CY", unit: "D", type: "number", precision: 2, icon: "CYL", inputMin: -15, inputMax: 15 },
        { id: "right_axis", category: "eyes", label: "右眼轴位", short: "R-AX", unit: "°", type: "number", precision: 0, icon: "AX", inputMin: 0, inputMax: 180 },
        { id: "right_pupillary_distance", category: "eyes", label: "右瞳距", short: "R-PD", unit: "mm", type: "number", precision: 1, icon: "PD", inputMin: 20, inputMax: 45 },

        { id: "wbc", category: "blood", label: "白细胞计数", short: "WBC", unit: "10^9/L", type: "number", precision: 2, icon: "WBC", low: 3.5, high: 9.5 },
        { id: "rbc", category: "blood", label: "红细胞计数", short: "RBC", unit: "10^12/L", type: "number", precision: 2, icon: "RBC", low: 4.3, high: 5.8 },
        { id: "hb", category: "blood", label: "血红蛋白", short: "Hb", unit: "g/L", type: "number", precision: 1, icon: "HB", low: 130, high: 175 },
        { id: "hct", category: "blood", label: "红细胞比容", short: "HCT", unit: "%", type: "number", precision: 3, icon: "HCT", low: 40, high: 50 },
        { id: "mcv", category: "blood", label: "平均红细胞体积", short: "MCV", unit: "fL", type: "number", precision: 1, icon: "MCV", low: 82, high: 100 },
        { id: "mch", category: "blood", label: "平均红细胞血红蛋白含量", short: "MCH", unit: "pg", type: "number", precision: 1, icon: "MCH", low: 27, high: 34 },
        { id: "mchc", category: "blood", label: "平均红细胞血红蛋白浓度", short: "MCHC", unit: "g/L", type: "number", precision: 0, icon: "MCHC", low: 316, high: 354 },
        { id: "rdw_cv", category: "blood", label: "红细胞分布宽度-变异系数", short: "RDW-CV", unit: "%", type: "number", precision: 1, icon: "RDV", low: 11, high: 16 },
        { id: "plt", category: "blood", label: "血小板计数", short: "PLT", unit: "10^9/L", type: "number", precision: 1, icon: "PLT", low: 125, high: 350 },
        { id: "mpv", category: "blood", label: "平均血小板体积", short: "MPV", unit: "fL", type: "number", precision: 1, icon: "MPV", low: 6.0, high: 11.0 },
        { id: "pdw", category: "blood", label: "血小板分布宽度", short: "PDW", unit: "", type: "number", precision: 1, icon: "PDW", low: 8, high: 18 },
        { id: "lymph_pct", category: "blood", label: "淋巴细胞百分比", short: "LYMPH%", unit: "%", type: "number", precision: 1, icon: "LY%", low: 20, high: 50 },
        { id: "neut_pct", category: "blood", label: "中性粒细胞百分比", short: "NEUT%", unit: "%", type: "number", precision: 1, icon: "NE%", low: 40, high: 75 },
        { id: "lymph", category: "blood", label: "淋巴细胞绝对值", short: "LYMPH", unit: "10^9/L", type: "number", precision: 2, icon: "LY", low: 1.1, high: 3.2 },
        { id: "neut", category: "blood", label: "中性粒细胞绝对值", short: "NEUT", unit: "10^9/L", type: "number", precision: 2, icon: "NE", low: 1.8, high: 6.3 },
        { id: "rdw_sd", category: "blood", label: "红细胞分布宽度-标准差", short: "RDW-SD", unit: "fL", type: "number", precision: 1, icon: "RDS", low: 35, high: 56 },
        { id: "pct", category: "blood", label: "血小板压积", short: "PCT", unit: "%", type: "number", precision: 2, icon: "PCT", low: 0.15, high: 0.50 },
        { id: "mono_pct", category: "blood", label: "单核细胞百分比", short: "MONO%", unit: "%", type: "number", precision: 1, icon: "MO%", low: 3, high: 10 },
        { id: "mono", category: "blood", label: "单核细胞绝对值", short: "MONO", unit: "10^9/L", type: "number", precision: 2, icon: "MON", low: 0.1, high: 0.6 },
        { id: "eos_pct", category: "blood", label: "嗜酸性细胞百分比", short: "EOS%", unit: "%", type: "number", precision: 1, icon: "EO%", low: 0.4, high: 8 },
        { id: "eos", category: "blood", label: "嗜酸性细胞绝对值", short: "EOS", unit: "10^9/L", type: "number", precision: 2, icon: "EOS", low: 0.02, high: 0.52 },
        { id: "baso_pct", category: "blood", label: "嗜碱性细胞百分比", short: "BASO%", unit: "%", type: "number", precision: 1, icon: "BA%", low: 0, high: 1 },
        { id: "baso", category: "blood", label: "嗜碱性细胞绝对值", short: "BASO", unit: "10^9/L", type: "number", precision: 2, icon: "BAS", low: 0, high: 0.06 },
        { id: "alt", category: "blood", label: "丙氨酸氨基转移酶", short: "ALT", unit: "U/L", type: "number", precision: 1, icon: "ALT", low: 0, high: 50 },
        { id: "ast", category: "blood", label: "天门冬氨酸氨基转移酶", short: "AST", unit: "U/L", type: "number", precision: 1, icon: "AST", low: 15, high: 40 },
        { id: "cr", category: "blood", label: "肌酐", short: "Cr", unit: "umol/L", type: "number", precision: 1, icon: "Cr", low: 57, high: 97 },
        { id: "tc", category: "blood", label: "总胆固醇", short: "TC", unit: "mmol/L", type: "number", precision: 2, icon: "TC", high: 5.2 },
        { id: "tg", category: "blood", label: "甘油三酯", short: "TG", unit: "mmol/L", type: "number", precision: 2, icon: "TG", low: 0.45, high: 1.81 },

        { id: "sg", category: "urine", label: "尿比重", short: "SG", unit: "", type: "number", precision: 3, icon: "SG", low: 1.003, high: 1.030 },
        { id: "ph", category: "urine", label: "尿酸碱度", short: "PH", unit: "", type: "number", precision: 1, icon: "PH", low: 4.5, high: 8.0 },
        { id: "leu", category: "urine", label: "尿白细胞", short: "LEU", unit: "Cells/ul", type: "binary", icon: "LEU" },
        { id: "nit", category: "urine", label: "尿亚硝酸盐", short: "NIT", unit: "", type: "binary", icon: "NIT" },
        { id: "pro", category: "urine", label: "尿蛋白质", short: "PRO", unit: "g/L", type: "binary", icon: "PRO" },
        { id: "glu", category: "urine", label: "尿糖", short: "GLU", unit: "mmol/L", type: "binary", icon: "GLU" },
        { id: "ket", category: "urine", label: "尿酮体", short: "KET", unit: "mmol/L", type: "binary", icon: "KET" },
        { id: "uro", category: "urine", label: "尿胆原", short: "URO", unit: "umol/L", type: "binary", icon: "URO" },
        { id: "bil", category: "urine", label: "尿胆红素", short: "BIL", unit: "umol/L", type: "binary", icon: "BIL" },
        { id: "bld", category: "urine", label: "尿隐血", short: "BLD", unit: "Cells/ul", type: "binary", icon: "BLD" }
      ];


      const ICON_SVGS = {
        ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"></rect><line x1="9" y1="7" x2="12" y2="7"></line><line x1="9" y1="10" x2="13" y2="10"></line><line x1="9" y1="13" x2="12" y2="13"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>',
        scale: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="5"></rect><path d="M8 12a4 4 0 0 1 8 0"></path><line x1="12" y1="12" x2="15.2" y2="9.6"></line></svg>',
        pressure: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4.2 4.2 0 0 1 7-2.8A4.2 4.2 0 0 1 19 10c0 5.5-7 10-7 10z"></path><path d="M6.5 12h3l1.4-2.2 1.9 4.2 1.3-2h2.8"></path></svg>',
        body: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.4"></circle><path d="M8.5 21v-5.2L7 11a2 2 0 0 1 1.9-2.6h6.2A2 2 0 0 1 17 11l-1.5 4.8V21"></path><line x1="12" y1="9" x2="12" y2="21"></line></svg>',
        eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="2.8"></circle></svg>',
        dominant: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="2.4"></circle><path d="M19 4.6l.9 2 .1.2 2.1.2-1.6 1.5-.1.1.4 2.1-1.8-1-1.9 1 .4-2.1-1.6-1.5 2.2-.2z"></path></svg>',
        eye_corrected: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="2.6"></circle><path d="M15.9 7.1l1.4 1.4 2.3-2.3"></path></svg>',
        eye_refraction: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.4"></circle><path d="M6 12h2.5"></path><path d="M15.5 12H18"></path><path d="M12 6v2.5"></path><path d="M12 15.5V18"></path></svg>',
        eye_axis: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.3"></circle><path d="M12 12l3.8-2.6"></path><path d="M6.7 12h1.8"></path><path d="M15.5 12h1.8"></path></svg>',
        eye_pd: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="2.2"></circle><circle cx="16" cy="12" r="2.2"></circle><path d="M6 18h12"></path><path d="M6 18l1.8-1.8"></path><path d="M6 18l1.8 1.8"></path><path d="M18 18l-1.8-1.8"></path><path d="M18 18l-1.8 1.8"></path></svg>',
        glasses: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7.5" cy="12" r="3.6"></circle><circle cx="16.5" cy="12" r="3.6"></circle><line x1="11.1" y1="12" x2="12.9" y2="12"></line><path d="M3.5 11l1.2-2h14.6l1.2 2"></path></svg>',
        blood_rbc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"></circle><circle cx="12" cy="12" r="2.6"></circle></svg>',
        blood_wbc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"></circle><circle cx="9.8" cy="11" r="1.3"></circle><circle cx="13.8" cy="10.4" r="1.2"></circle><circle cx="12" cy="14" r="1.3"></circle></svg>',
        blood_platelet: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.4" cy="11" r="1.5"></circle><circle cx="12.5" cy="9.2" r="1.3"></circle><circle cx="15.3" cy="13.5" r="1.5"></circle><path d="M5.3 16.4c2-1.7 4.2-2.5 6.7-2.5 2.6 0 4.8.8 6.7 2.5"></path></svg>',
        blood_diff: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7.2" cy="8.2" r="1.5"></circle><circle cx="16.4" cy="7.4" r="1.5"></circle><circle cx="9.8" cy="15.7" r="1.5"></circle><circle cx="17" cy="15.2" r="1.5"></circle><path d="M8.7 8.8l6.2-1"></path><path d="M8.2 9.5l1 4.5"></path><path d="M14.9 8.8l1.4 4.9"></path><path d="M11.3 15.6l4.2-.3"></path></svg>',
        blood_biochem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5h6"></path><path d="M10 4.5v5.8l-3.1 6.1a2.7 2.7 0 0 0 2.4 3.9h5.4a2.7 2.7 0 0 0 2.4-3.9L14 10.3V4.5"></path><path d="M9.5 13.2h5"></path></svg>',
        blood: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c1.6 2.8 5.8 7 5.8 10.7a5.8 5.8 0 1 1-11.6 0C6.2 10.2 10.4 6 12 3.2z"></path><circle class="fill" cx="12" cy="15" r="1.8"></circle></svg>',
        urine_tube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5h6"></path><path d="M10 4.5v6.4a4 4 0 1 0 4 0V4.5"></path><path d="M10.4 11.9h3.2"></path></svg>',
        urine_microbe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.4"></circle><path d="M12 5.5v2"></path><path d="M12 16.5v2"></path><path d="M5.5 12h2"></path><path d="M16.5 12h2"></path><path d="M7.8 7.8l1.4 1.4"></path><path d="M14.8 14.8l1.4 1.4"></path><path d="M16.2 7.8l-1.4 1.4"></path><path d="M7.8 16.2l1.4-1.4"></path></svg>',
        urine_molecule: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.8l5.2 3v6.4L12 17.2l-5.2-3V7.8z"></path><circle cx="12" cy="11" r="1.3"></circle><path d="M12 9.7v-2"></path></svg>',
        urine_pigment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c1.8 2.9 5.5 6.4 5.5 9.7a5.5 5.5 0 1 1-11 0C6.5 10.4 10.2 6.9 12 4z"></path><circle cx="12" cy="13.8" r="2"></circle></svg>',
        urine_blood: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8c2 3 5.8 6.7 5.8 10.3A5.8 5.8 0 0 1 12 20 5.8 5.8 0 0 1 6.2 14.1c0-3.6 3.8-7.3 5.8-10.3z"></path><circle cx="12" cy="14" r="1.4"></circle><path d="M8.8 17.2h6.4"></path></svg>',
        urine: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6c2 3.2 6.2 7.1 6.2 11A6.2 6.2 0 0 1 12 20.8 6.2 6.2 0 0 1 5.8 14.6c0-3.9 4.2-7.8 6.2-11z"></path><path d="M12 10v7"></path><line x1="9.4" y1="14" x2="14.6" y2="14"></line></svg>',
        metric: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><line x1="8" y1="15" x2="11" y2="11"></line><line x1="11" y1="11" x2="14" y2="13"></line><line x1="14" y1="13" x2="17" y2="8"></line></svg>'
      };

      const UI_ICONS = {
        add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
        pull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"></path><path d="M8.5 10.8L12 14.2l3.5-3.4"></path><path d="M5 18.2h14"></path></svg>',
        save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l2 2v16H5z"></path><path d="M8 3v6h8V3"></path><path d="M8 16h8"></path></svg>',
        loading: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 1-8 8"></path></svg>',
        lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 1 1 8 0v3"></path></svg>',
        edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4.2-1 10-10a1.8 1.8 0 0 0 0-2.6l-.6-.6a1.8 1.8 0 0 0-2.6 0l-10 10L4 20z"></path><path d="M13.5 6.5l4 4"></path></svg>',
        delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><rect x="6.5" y="7" width="11" height="13" rx="1.8"></rect><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>',
        check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13l5 5 11-11"></path></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>',
        date: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"></rect><path d="M7.5 3.5v3"></path><path d="M16.5 3.5v3"></path><path d="M3.5 9h17"></path></svg>',
        refLow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M8 15l4 4 4-4"></path></svg>',
        refHigh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"></path><path d="M8 9l4-4 4 4"></path></svg>',
        axisMin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"></path><path d="M8 14l4 4 4-4"></path></svg>',
        axisMax: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M8 10l4-4 4 4"></path></svg>',
        trend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"></path><path d="M6 15l4-4 3 2 5-5"></path><circle cx="6" cy="15" r="1"></circle><circle cx="10" cy="11" r="1"></circle><circle cx="13" cy="13" r="1"></circle><circle cx="18" cy="8" r="1"></circle></svg>',
        inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M4 7l3.5 5h9L20 7"></path><path d="M10 15h4"></path></svg>'
      };

  window.LeeOSBodyMetricsConstants = Object.freeze({
    DATA_FILE,
    CATEGORIES,
    FIXED_METRICS,
    ICON_SVGS,
    UI_ICONS,
  })
})()
