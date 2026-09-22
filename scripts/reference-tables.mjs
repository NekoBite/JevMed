// Clinical reference tables used by the mock-data generator.
// Values follow SI units as used in Hong Kong and mainland China.

export const DEPARTMENTS = [
  { id: 'IM',   en: 'Internal Medicine',  hant: '內科',     hans: '内科' },
  { id: 'CARD', en: 'Cardiology',         hant: '心臟科',   hans: '心脏科' },
  { id: 'ENDO', en: 'Endocrinology',      hant: '內分泌科', hans: '内分泌科' },
  { id: 'NEPH', en: 'Nephrology',         hant: '腎科',     hans: '肾科' },
  { id: 'ORTH', en: 'Orthopaedics',       hant: '骨科',     hans: '骨科' },
  { id: 'ONCO', en: 'Oncology',           hant: '腫瘤科',   hans: '肿瘤科' },
  { id: 'NEUR', en: 'Neurology',          hant: '神經科',   hans: '神经科' },
  { id: 'RESP', en: 'Respiratory',        hant: '呼吸科',   hans: '呼吸科' },
  { id: 'RAD',  en: 'Radiology',          hant: '放射科',   hans: '放射科' },
  { id: 'ER',   en: 'Emergency',          hant: '急症科',   hans: '急诊科' },
  { id: 'PHAR', en: 'Pharmacy',           hant: '藥劑部',   hans: '药剂部' },
  { id: 'NURS', en: 'Nursing',            hant: '護理部',   hans: '护理部' },
]

export const CONDITIONS = [
  { icd: 'E11.9',  dept: 'ENDO', en: 'Type 2 diabetes mellitus without complications', hant: '二型糖尿病，無併發症', hans: '二型糖尿病，无并发症' },
  { icd: 'I10',    dept: 'CARD', en: 'Essential (primary) hypertension', hant: '原發性高血壓', hans: '原发性高血压' },
  { icd: 'I25.10', dept: 'CARD', en: 'Atherosclerotic heart disease of native coronary artery', hant: '冠狀動脈粥樣硬化性心臟病', hans: '冠状动脉粥样硬化性心脏病' },
  { icd: 'N18.3',  dept: 'NEPH', en: 'Chronic kidney disease, stage 3', hant: '慢性腎病三期', hans: '慢性肾病三期' },
  { icd: 'J44.9',  dept: 'RESP', en: 'Chronic obstructive pulmonary disease, unspecified', hant: '慢性阻塞性肺病', hans: '慢性阻塞性肺病' },
  { icd: 'M17.11', dept: 'ORTH', en: 'Primary osteoarthritis, right knee', hant: '右膝原發性骨關節炎', hans: '右膝原发性骨关节炎' },
  { icd: 'E78.5',  dept: 'IM',   en: 'Hyperlipidaemia, unspecified', hant: '高脂血症', hans: '高脂血症' },
  { icd: 'I48.91', dept: 'CARD', en: 'Atrial fibrillation, unspecified', hant: '心房顫動', hans: '心房颤动' },
  { icd: 'K21.9',  dept: 'IM',   en: 'Gastro-oesophageal reflux disease without oesophagitis', hant: '胃食道逆流病', hans: '胃食管反流病' },
  { icd: 'F03.90', dept: 'NEUR', en: 'Unspecified dementia without behavioural disturbance', hant: '未特指之認知障礙症', hans: '未特指之认知障碍症' },
  { icd: 'M81.0',  dept: 'ORTH', en: 'Age-related osteoporosis without current pathological fracture', hant: '老年性骨質疏鬆症', hans: '老年性骨质疏松症' },
  { icd: 'I63.9',  dept: 'NEUR', en: 'Cerebral infarction, unspecified', hant: '腦梗塞', hans: '脑梗塞' },
  { icd: 'N40.0',  dept: 'IM',   en: 'Benign prostatic hyperplasia without lower urinary tract symptoms', hant: '良性前列腺增生', hans: '良性前列腺增生' },
  { icd: 'C34.90', dept: 'ONCO', en: 'Malignant neoplasm of bronchus or lung, unspecified', hant: '支氣管及肺惡性腫瘤', hans: '支气管及肺恶性肿瘤' },
  { icd: 'E03.9',  dept: 'ENDO', en: 'Hypothyroidism, unspecified', hant: '甲狀腺功能減退症', hans: '甲状腺功能减退症' },
  { icd: 'D64.9',  dept: 'IM',   en: 'Anaemia, unspecified', hant: '貧血', hans: '贫血' },
]

// Reference intervals: adult, SI units. [low, high] — null means one-sided.
export const LAB_PANELS = [
  { panel: 'CBC', en: 'Complete Blood Count', hant: '全血細胞計數', hans: '全血细胞计数', analytes: [
    { code: 'HGB',  en: 'Haemoglobin',  hant: '血紅蛋白', hans: '血红蛋白', unit: 'g/dL',    ref: { M: [13.5, 17.5], F: [12.0, 15.5] }, dp: 1 },
    { code: 'WBC',  en: 'White Cell Count', hant: '白血球計數', hans: '白细胞计数', unit: '×10⁹/L', ref: { M: [4.0, 11.0], F: [4.0, 11.0] }, dp: 1 },
    { code: 'PLT',  en: 'Platelet Count', hant: '血小板計數', hans: '血小板计数', unit: '×10⁹/L', ref: { M: [150, 400], F: [150, 400] }, dp: 0 },
  ]},
  { panel: 'RFT', en: 'Renal Function', hant: '腎功能', hans: '肾功能', analytes: [
    { code: 'CREA', en: 'Creatinine', hant: '肌酸酐', hans: '肌酐', unit: 'µmol/L', ref: { M: [62, 106], F: [44, 80] }, dp: 0 },
    { code: 'EGFR', en: 'eGFR', hant: '估算腎小球濾過率', hans: '估算肾小球滤过率', unit: 'mL/min/1.73m²', ref: { M: [90, null], F: [90, null] }, dp: 0 },
    { code: 'K',    en: 'Potassium', hant: '鉀', hans: '钾', unit: 'mmol/L', ref: { M: [3.5, 5.1], F: [3.5, 5.1] }, dp: 1 },
    { code: 'NA',   en: 'Sodium', hant: '鈉', hans: '钠', unit: 'mmol/L', ref: { M: [136, 145], F: [136, 145] }, dp: 0 },
  ]},
  { panel: 'LFT', en: 'Liver Function', hant: '肝功能', hans: '肝功能', analytes: [
    { code: 'ALT', en: 'Alanine Aminotransferase', hant: '丙氨酸轉氨酶', hans: '丙氨酸转氨酶', unit: 'U/L', ref: { M: [7, 56], F: [7, 56] }, dp: 0 },
    { code: 'AST', en: 'Aspartate Aminotransferase', hant: '天門冬氨酸轉氨酶', hans: '天门冬氨酸转氨酶', unit: 'U/L', ref: { M: [10, 40], F: [10, 40] }, dp: 0 },
    { code: 'ALB', en: 'Albumin', hant: '白蛋白', hans: '白蛋白', unit: 'g/L', ref: { M: [35, 52], F: [35, 52] }, dp: 0 },
  ]},
  { panel: 'GLU', en: 'Glycaemic Control', hant: '血糖控制', hans: '血糖控制', analytes: [
    { code: 'HBA1C', en: 'Haemoglobin A1c', hant: '糖化血紅蛋白', hans: '糖化血红蛋白', unit: '%', ref: { M: [4.0, 5.6], F: [4.0, 5.6] }, dp: 1 },
    { code: 'FBG',   en: 'Fasting Glucose', hant: '空腹血糖', hans: '空腹血糖', unit: 'mmol/L', ref: { M: [3.9, 5.5], F: [3.9, 5.5] }, dp: 1 },
  ]},
  { panel: 'LIPID', en: 'Lipid Profile', hant: '血脂', hans: '血脂', analytes: [
    { code: 'TC',   en: 'Total Cholesterol', hant: '總膽固醇', hans: '总胆固醇', unit: 'mmol/L', ref: { M: [null, 5.2], F: [null, 5.2] }, dp: 1 },
    { code: 'LDL',  en: 'LDL Cholesterol', hant: '低密度脂蛋白膽固醇', hans: '低密度脂蛋白胆固醇', unit: 'mmol/L', ref: { M: [null, 3.4], F: [null, 3.4] }, dp: 1 },
    { code: 'HDL',  en: 'HDL Cholesterol', hant: '高密度脂蛋白膽固醇', hans: '高密度脂蛋白胆固醇', unit: 'mmol/L', ref: { M: [1.0, null], F: [1.3, null] }, dp: 1 },
    { code: 'TG',   en: 'Triglycerides', hant: '三酸甘油酯', hans: '甘油三酯', unit: 'mmol/L', ref: { M: [null, 1.7], F: [null, 1.7] }, dp: 1 },
  ]},
  { panel: 'THY', en: 'Thyroid Function', hant: '甲狀腺功能', hans: '甲状腺功能', analytes: [
    { code: 'TSH', en: 'Thyroid Stimulating Hormone', hant: '促甲狀腺素', hans: '促甲状腺素', unit: 'mIU/L', ref: { M: [0.4, 4.0], F: [0.4, 4.0] }, dp: 2 },
  ]},
  { panel: 'INFL', en: 'Inflammatory Markers', hant: '炎症指標', hans: '炎症指标', analytes: [
    { code: 'CRP', en: 'C-Reactive Protein', hant: 'C反應蛋白', hans: 'C反应蛋白', unit: 'mg/L', ref: { M: [null, 5], F: [null, 5] }, dp: 1 },
  ]},
]

export const DRUGS = [
  { code: 'METF', en: 'Metformin',        hant: '二甲雙胍',   hans: '二甲双胍',   dose: '500 mg', freq: 'BD',  route: 'PO', cls: 'Biguanide' },
  { code: 'AMLO', en: 'Amlodipine',       hant: '氨氯地平',   hans: '氨氯地平',   dose: '5 mg',   freq: 'OD',  route: 'PO', cls: 'Calcium channel blocker' },
  { code: 'ATOR', en: 'Atorvastatin',     hant: '阿托伐他汀', hans: '阿托伐他汀', dose: '20 mg',  freq: 'Nocte', route: 'PO', cls: 'Statin' },
  { code: 'LISI', en: 'Lisinopril',       hant: '賴諾普利',   hans: '赖诺普利',   dose: '10 mg',  freq: 'OD',  route: 'PO', cls: 'ACE inhibitor' },
  { code: 'ASPI', en: 'Aspirin',          hant: '阿士匹靈',   hans: '阿司匹林',   dose: '80 mg',  freq: 'OD',  route: 'PO', cls: 'Antiplatelet' },
  { code: 'WARF', en: 'Warfarin',         hant: '華法林',     hans: '华法林',     dose: '3 mg',   freq: 'OD',  route: 'PO', cls: 'Anticoagulant' },
  { code: 'FURO', en: 'Furosemide',       hant: '呋塞米',     hans: '呋塞米',     dose: '40 mg',  freq: 'OD',  route: 'PO', cls: 'Loop diuretic' },
  { code: 'LEVO', en: 'Levothyroxine',    hant: '左甲狀腺素', hans: '左甲状腺素', dose: '50 µg',  freq: 'OD',  route: 'PO', cls: 'Thyroid hormone' },
  { code: 'GLAR', en: 'Insulin glargine', hant: '甘精胰島素', hans: '甘精胰岛素', dose: '18 units', freq: 'Nocte', route: 'SC', cls: 'Basal insulin' },
  { code: 'SALB', en: 'Salbutamol',       hant: '沙丁胺醇',   hans: '沙丁胺醇',   dose: '100 µg', freq: 'PRN', route: 'INH', cls: 'SABA' },
  { code: 'OMEP', en: 'Omeprazole',       hant: '奧美拉唑',   hans: '奥美拉唑',   dose: '20 mg',  freq: 'OD',  route: 'PO', cls: 'Proton pump inhibitor' },
  { code: 'BISO', en: 'Bisoprolol',       hant: '比索洛爾',   hans: '比索洛尔',   dose: '2.5 mg', freq: 'OD',  route: 'PO', cls: 'Beta blocker' },
  { code: 'ALEN', en: 'Alendronate',      hant: '阿侖膦酸鈉', hans: '阿仑膦酸钠', dose: '70 mg',  freq: 'Weekly', route: 'PO', cls: 'Bisphosphonate' },
  { code: 'DONE', en: 'Donepezil',        hant: '多奈哌齊',   hans: '多奈哌齐',   dose: '5 mg',   freq: 'Nocte', route: 'PO', cls: 'Cholinesterase inhibitor' },
  { code: 'TAMS', en: 'Tamsulosin',       hant: '坦索羅辛',   hans: '坦索罗辛',   dose: '0.4 mg', freq: 'OD',  route: 'PO', cls: 'Alpha blocker' },
  { code: 'CLOP', en: 'Clopidogrel',      hant: '氯吡格雷',   hans: '氯吡格雷',   dose: '75 mg',  freq: 'OD',  route: 'PO', cls: 'Antiplatelet' },
  { code: 'GLIC', en: 'Gliclazide',       hant: '格列齊特',   hans: '格列齐特',   dose: '80 mg',  freq: 'OD',  route: 'PO', cls: 'Sulfonylurea' },
  { code: 'EMPA', en: 'Empagliflozin',    hant: '恩格列淨',   hans: '恩格列净',   dose: '10 mg',  freq: 'OD',  route: 'PO', cls: 'SGLT2 inhibitor' },
]

export const ALLERGENS = [
  { en: 'Penicillin', hant: '盤尼西林', hans: '青霉素' },
  { en: 'Sulfonamides', hant: '磺胺類', hans: '磺胺类' },
  { en: 'Shellfish', hant: '貝類', hans: '贝类' },
  { en: 'Iodinated contrast', hant: '碘造影劑', hans: '碘造影剂' },
  { en: 'NSAIDs', hant: '非類固醇消炎藥', hans: '非甾体抗炎药' },
  { en: 'Latex', hant: '乳膠', hans: '乳胶' },
]

export const SURNAMES = [
  ['Chan','陳','陈'],['Wong','黃','黄'],['Lee','李','李'],['Cheung','張','张'],['Lam','林','林'],
  ['Ng','吳','吴'],['Ho','何','何'],['Chow','周','周'],['Tang','鄧','邓'],['Yeung','楊','杨'],
  ['Tsang','曾','曾'],['Leung','梁','梁'],['Cheng','鄭','郑'],['Kwok','郭','郭'],['Ma','馬','马'],
  ['Lau','劉','刘'],['Hui','許','许'],['Fung','馮','冯'],['Tam','譚','谭'],['Yip','葉','叶'],
  ['Zhang','張','张'],['Wang','王','王'],['Zhao','趙','赵'],['Sun','孫','孙'],['Xu','徐','徐'],
]

export const GIVEN_M = [
  ['Ka-ming','家明','家明'],['Wai-keung','偉強','伟强'],['Chi-hung','志雄','志雄'],
  ['Kwok-wah','國華','国华'],['Tak-sing','德誠','德诚'],['Chun-kit','俊傑','俊杰'],
  ['Man-ho','文浩','文浩'],['Ho-yin','浩然','浩然'],['Kin-fai','健輝','健辉'],
  ['Siu-kwan','兆鈞','兆钧'],['Wei','偉','伟'],['Jianguo','建國','建国'],
  ['Yuwen','宇文','宇文'],['Hanchen','翰辰','翰辰'],['Zhiyuan','志遠','志远'],
]

export const GIVEN_F = [
  ['Siu-fong','小芳','小芳'],['Mei-ling','美玲','美玲'],['Suk-yee','淑儀','淑仪'],
  ['Yuk-lan','玉蘭','玉兰'],['Wing-yee','詠儀','咏仪'],['Lai-chun','麗珍','丽珍'],
  ['Sau-king','秀瓊','秀琼'],['Pui-shan','佩珊','佩珊'],['Yuen-ching','婉晴','婉晴'],
  ['Cheuk-yiu','卓瑤','卓瑶'],['Sze-wai','詩慧','诗慧'],['Na','娜','娜'],
  ['Jing','靜','静'],['Fang','芳','芳'],['Xiuying','秀英','秀英'],
]

export const DISTRICTS = [
  { en: 'Central & Western, HK', hant: '中西區・香港', hans: '中西区・香港' },
  { en: 'Wan Chai, HK', hant: '灣仔・香港', hans: '湾仔・香港' },
  { en: 'Kowloon City, KLN', hant: '九龍城・九龍', hans: '九龙城・九龙' },
  { en: 'Sha Tin, NT', hant: '沙田・新界', hans: '沙田・新界' },
  { en: 'Tsuen Wan, NT', hant: '荃灣・新界', hans: '荃湾・新界' },
  { en: 'Yau Tsim Mong, KLN', hant: '油尖旺・九龍', hans: '油尖旺・九龙' },
  { en: 'Futian, Shenzhen', hant: '福田・深圳', hans: '福田・深圳' },
  { en: 'Nanshan, Shenzhen', hant: '南山・深圳', hans: '南山・深圳' },
  { en: 'Tianhe, Guangzhou', hant: '天河・廣州', hans: '天河・广州' },
  { en: 'Zhuhai, Guangdong', hant: '珠海・廣東', hans: '珠海・广东' },
]

export const PAYERS = [
  { id: 'HA',    en: 'Hospital Authority (public)', hant: '醫院管理局（公營）', hans: '医院管理局（公营）' },
  { id: 'BUPA',  en: 'Bupa Hong Kong', hant: '保柏香港', hans: '保柏香港' },
  { id: 'AIA',   en: 'AIA Group', hant: '友邦保險', hans: '友邦保险' },
  { id: 'VHIS',  en: 'VHIS Certified Plan', hant: '自願醫保計劃', hans: '自愿医保计划' },
  { id: 'PRU',   en: 'Prudential HK', hant: '保誠香港', hans: '保诚香港' },
  { id: 'CNMI',  en: 'Mainland Basic Medical Insurance', hant: '內地基本醫療保險', hans: '内地基本医疗保险' },
  { id: 'SELF',  en: 'Self-pay', hant: '自費', hans: '自费' },
]

export const IMAGING = [
  { mod: 'XR', en: 'Chest X-Ray', hant: '胸部X光', hans: '胸部X光', part: 'Chest' },
  { mod: 'CT', en: 'CT Thorax with contrast', hant: '胸部電腦掃描（造影）', hans: '胸部电脑断层（造影）', part: 'Thorax' },
  { mod: 'CT', en: 'CT Brain non-contrast', hant: '腦部電腦掃描（無造影）', hans: '脑部电脑断层（无造影）', part: 'Brain' },
  { mod: 'MR', en: 'MRI Lumbar Spine', hant: '腰椎磁力共振', hans: '腰椎磁共振', part: 'Lumbar spine' },
  { mod: 'US', en: 'Ultrasound Abdomen', hant: '腹部超聲波', hans: '腹部超声', part: 'Abdomen' },
  { mod: 'US', en: 'Echocardiogram', hant: '心臟超聲波', hans: '心脏超声', part: 'Heart' },
  { mod: 'XR', en: 'X-Ray Right Knee', hant: '右膝X光', hans: '右膝X光', part: 'Right knee' },
  { mod: 'DXA', en: 'DXA Bone Density', hant: '骨質密度掃描', hans: '骨密度扫描', part: 'Hip / spine' },
]
