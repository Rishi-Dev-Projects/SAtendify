import io
import re
import csv

def extract_text_from_pdf(file_bytes):
    """Extracts text from all pages of a PDF using pypdf."""
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        full_text = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                full_text.append(text)
        return "\n".join(full_text)
    except Exception as e:
        print(f"pypdf extraction error: {e}")
        return ""

def extract_from_excel(file_bytes, filename=""):
    """Extracts structured rows from Excel (.xlsx, .xls) using openpyxl or pandas."""
    subjects = []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return subjects

        # Search for header row
        code_col = -1
        name_col = -1
        l_col = -1
        t_col = -1
        p_col = -1
        c_col = -1

        for r_idx, row in enumerate(rows[:15]):
            row_str = [str(c).strip().lower() if c is not None else "" for c in row]
            for c_idx, cell in enumerate(row_str):
                if any(k in cell for k in ['sub_code', 'subject code', 'course code', 'sub code', 'code']):
                    code_col = c_idx
                elif any(k in cell for k in ['sub_name', 'subject name', 'course title', 'course name', 'subject', 'title']):
                    name_col = c_idx
                elif cell == 'l' or 'lecture' in cell:
                    l_col = c_idx
                elif cell == 't' or 'tutorial' in cell:
                    t_col = c_idx
                elif cell == 'p' or 'practical' in cell or 'lab' in cell:
                    p_col = c_idx
                elif cell == 'c' or 'credit' in cell or 'cr' == cell:
                    c_col = c_idx

            if code_col != -1 and name_col != -1:
                # Header found, process data rows
                for data_row in rows[r_idx + 1:]:
                    if not data_row or len(data_row) <= max(code_col, name_col):
                        continue
                    code_val = str(data_row[code_col] or "").strip()
                    name_val = str(data_row[name_col] or "").strip()

                    # Validate code
                    if not re.match(r'^[A-Za-z0-9]{4,15}$', code_val) or code_val.lower() in ['code', 'total', 'sr', 'sr no']:
                        continue
                    if len(name_val) < 2:
                        continue

                    def safe_int(idx, default=0):
                        if idx != -1 and idx < len(data_row) and data_row[idx] is not None:
                            try:
                                return int(float(str(data_row[idx]).strip()))
                            except ValueError:
                                return default
                        return default

                    l_hrs = safe_int(l_col, 3)
                    t_hrs = safe_int(t_col, 0)
                    p_hrs = safe_int(p_col, 2 if l_hrs < 4 else 0)
                    credits = safe_int(c_col, l_hrs + (p_hrs // 2))

                    subjects.append({
                        "code": code_val.upper(),
                        "name": name_val,
                        "lectureHours": l_hrs,
                        "tutorialHours": t_hrs,
                        "labHours": p_hrs,
                        "hasLab": p_hrs > 0,
                        "credits": credits
                    })
                break
    except Exception as e:
        print(f"Excel extraction error: {e}")
    return subjects

def extract_from_csv(file_bytes):
    """Extracts structured rows from CSV."""
    subjects = []
    try:
        text = file_bytes.decode('utf-8', errors='ignore')
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return subjects

        code_col = -1
        name_col = -1
        l_col = -1
        t_col = -1
        p_col = -1
        c_col = -1

        for r_idx, row in enumerate(rows[:10]):
            row_lower = [c.strip().lower() for c in row]
            for c_idx, cell in enumerate(row_lower):
                if 'code' in cell:
                    code_col = c_idx
                elif any(k in cell for k in ['name', 'title', 'subject']):
                    name_col = c_idx
                elif cell == 'l' or 'lecture' in cell:
                    l_col = c_idx
                elif cell == 't' or 'tutorial' in cell:
                    t_col = c_idx
                elif cell == 'p' or 'practical' in cell or 'lab' in cell:
                    p_col = c_idx
                elif cell == 'c' or 'credit' in cell:
                    c_col = c_idx

            if code_col != -1 and name_col != -1:
                for data_row in rows[r_idx + 1:]:
                    if len(data_row) <= max(code_col, name_col):
                        continue
                    code_val = data_row[code_col].strip()
                    name_val = data_row[name_col].strip()
                    if not re.match(r'^[A-Za-z0-9]{4,15}$', code_val) or code_val.lower() in ['code', 'total', 'sr', 'sr no']:
                        continue
                    if len(name_val) < 2:
                        continue

                    def safe_int(idx, default=0):
                        if idx != -1 and idx < len(data_row) and data_row[idx].strip():
                            try:
                                return int(float(data_row[idx].strip()))
                            except ValueError:
                                return default
                        return default

                    l_hrs = safe_int(l_col, 3)
                    t_hrs = safe_int(t_col, 0)
                    p_hrs = safe_int(p_col, 0)
                    credits = safe_int(c_col, l_hrs + (p_hrs // 2))

                    subjects.append({
                        "code": code_val.upper(),
                        "name": name_val,
                        "lectureHours": l_hrs,
                        "tutorialHours": t_hrs,
                        "labHours": p_hrs,
                        "hasLab": p_hrs > 0,
                        "credits": credits
                    })
                break
    except Exception as e:
        print(f"CSV extraction error: {e}")
    return subjects

def parse_gtu_syllabus_text(text, default_sem=None, default_dept=None, filename=""):
    """
    Intelligent GTU syllabus text parser.
    Detects both individual course syllabus documents (single subject per PDF) and
    overall Teaching & Examination Scheme tables (multiple subjects per table).
    """
    detected_sem = default_sem
    detected_dept = default_dept

    # Detect semester (supports 1st..8th or Roman numerals I..VIII)
    sem_match = re.search(r'Semester\s*[-–—:]?\s*(?:Semester\s*)?([1-8]|I{1,3}|IV|V|VI{1,3}|VIII)(?:st|nd|rd|th)?\b', text, re.I)
    if sem_match:
        val = sem_match.group(1).upper()
        roman = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8}
        detected_sem = roman.get(val, int(val) if val.isdigit() else detected_sem)

    # Detect department / branch
    branch_match = re.search(r'Branch\s*[-–—:]?\s*([^\n\r]+)', text, re.I)
    branch_context = (branch_match.group(1) if branch_match else '') + ' ' + text[:2500]
    if re.search(r'Information\s*Technology', branch_context, re.I):
        detected_dept = 'IT'
    elif re.search(r'Computer\s*(?:Engineering|Science)', branch_context, re.I):
        detected_dept = 'CE'
    elif re.search(r'Mechanical\s*Engineering', branch_context, re.I):
        detected_dept = 'ME'
    elif re.search(r'Civil\s*Engineering', branch_context, re.I):
        detected_dept = 'CL'
    elif re.search(r'Electrical\s*Engineering', branch_context, re.I):
        detected_dept = 'EE'

    subjects = []
    seen_codes = set()

    # ==========================================
    # STRATEGY 1: SINGLE-SUBJECT GTU SYLLABUS PDF
    # (Matches standard GTU syllabus documents e.g. DI03016061 Operating Systems)
    # ==========================================
    single_code = None
    code_m = re.search(r'(?:Course|Subject|Sub)\s*(?:/\s*(?:Course|Subject|Sub))?\s*(?:Code|No\.?)[\s:\-–—]+([A-Za-z0-9]{4,15})', text, re.I)
    if code_m:
        single_code = code_m.group(1).strip().upper()
    elif filename:
        fn_code = re.search(r'\b([A-Za-z]{2,4}\d{6,8}|\d{7,8})\b', filename)
        if fn_code:
            single_code = fn_code.group(1).upper()

    # Search for GTU standard code pattern in the text if not found yet
    if not single_code:
        general_code = re.search(r'\b([A-Za-z]{2}\d{7,8}|\b[1-4]\d{6}\b)\b', text[:3500])
        if general_code:
            single_code = general_code.group(1).upper()

    single_name = None
    name_m = re.search(r'(?:Course|Subject|Sub)\s*(?:/\s*(?:Course|Subject|Sub))?\s*(?:Name|Title)[\s:\-–—]+([^\n\r]+)', text, re.I)
    if not name_m:
        name_m = re.search(r'(?:Name of (?:the )?(?:Course|Subject))[\s:\-–—]+([^\n\r]+)', text, re.I)
    if name_m:
        raw_name = name_m.group(1).strip()
        single_name = re.sub(r'\s*(?:W\.?e\.?f|Semester|Category|Page|http|Gujarat).*$', '', raw_name, flags=re.I).strip()
    elif filename and single_code:
        # Fallback from filename, e.g. "OS – DI03016061 Syllabus"
        fn_clean = re.sub(r'\[.*?\]|\(.*?\)', '', filename).replace('.pdf', '')
        parts = fn_clean.split('–') if '–' in fn_clean else fn_clean.split('-')
        if len(parts) > 1:
            candidate = parts[0].strip()
            if len(candidate) > 1 and not re.match(r'^[A-Za-z0-9]{5,12}$', candidate):
                single_name = candidate
        elif len(parts) == 1:
            cand = re.sub(r'\b(?:DI\d+|\d{7}|Syllabus|GTU|Ranker)\b', '', fn_clean, flags=re.I).strip()
            if len(cand) >= 2:
                single_name = cand

    if not single_code and filename:
        clean_fn = re.sub(r'[^a-zA-Z0-9]', '', filename.replace('.pdf', ''))[:10].upper()
        if len(clean_fn) >= 2:
            single_code = f"GTU{clean_fn}"
            single_name = filename.replace('.pdf', '').strip()

    if single_code:
        l_hrs = 3
        t_hrs = 0
        p_hrs = 0
        credits = 4

        # Table scheme pattern: L T PR C or L T P C followed by numbers
        scheme_m = re.search(r'\bL\s+T\s+(?:PR|P)\s+C\b[\s\S]{0,250}?\b(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\b', text, re.I)
        if not scheme_m:
            scheme_m = re.search(r'\bL\s+T\s+P\s+C\b[\s\S]{0,250}?\b(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\b', text, re.I)

        if scheme_m:
            l_hrs = int(scheme_m.group(1))
            t_hrs = int(scheme_m.group(2))
            p_hrs = int(scheme_m.group(3))
            credits = int(scheme_m.group(4))
        else:
            # Key-value fallback: L: 3, T: 0, P: 2
            l_m = re.search(r'\bL\s*[:\-=]?\s*(\d+)', text, re.I)
            t_m = re.search(r'\bT\s*[:\-=]?\s*(\d+)', text, re.I)
            p_m = re.search(r'\b(?:PR|P)\s*[:\-=]?\s*(\d+)', text, re.I)
            c_m = re.search(r'\bC(?:redits?)?\s*[:\-=]?\s*(\d+)', text, re.I)
            if l_m: l_hrs = int(l_m.group(1))
            if t_m: t_hrs = int(t_m.group(1))
            if p_m: p_hrs = int(p_m.group(1))
            if c_m: credits = int(c_m.group(1))
            else: credits = l_hrs + (p_hrs // 2)

        final_title = single_name or f"Course {single_code}"
        seen_codes.add(single_code)
        subjects.append({
            "code": single_code,
            "name": final_title,
            "lectureHours": l_hrs,
            "tutorialHours": t_hrs,
            "labHours": p_hrs,
            "hasLab": p_hrs > 0,
            "credits": credits,
            "semester": detected_sem or default_sem or 5,
            "department": detected_dept or default_dept or "IT"
        })

    # ==========================================
    # STRATEGY 2: MULTI-SUBJECT TEACHING SCHEME TABLES
    # (Matches semester-wide curriculum matrix)
    # ==========================================
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Check for pipe-delimited format: e.g. 1 | DI05016011 | AI Product Design | 3 | 0 | 2 | 4
        if '|' in line:
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 6:
                code_cand = None
                code_idx = -1
                for idx in [0, 1]:
                    if idx < len(parts) and re.match(r'^[A-Za-z0-9]{4,15}$', parts[idx]) and parts[idx].lower() not in ['sr', 'code', 'sr.no', 'course code']:
                        code_cand = parts[idx].upper()
                        code_idx = idx
                        break

                if code_cand and code_cand not in seen_codes:
                    name_idx = code_idx + 1
                    name_cand = parts[name_idx]
                    if len(name_cand) >= 2 and not name_cand.lower().startswith('course title'):
                        def to_num(val, def_val=0):
                            nums = re.findall(r'\d+', val)
                            return int(nums[0]) if nums else def_val

                        l_val = to_num(parts[name_idx + 1], 3) if name_idx + 1 < len(parts) else 3
                        t_val = to_num(parts[name_idx + 2], 0) if name_idx + 2 < len(parts) else 0
                        p_val = to_num(parts[name_idx + 3], 2) if name_idx + 3 < len(parts) else 2
                        c_val = to_num(parts[name_idx + 4], l_val + p_val // 2) if name_idx + 4 < len(parts) else (l_val + p_val // 2)

                        seen_codes.add(code_cand)
                        subjects.append({
                            "code": code_cand,
                            "name": name_cand,
                            "lectureHours": l_val,
                            "tutorialHours": t_val,
                            "labHours": p_val,
                            "hasLab": p_val > 0,
                            "credits": c_val,
                            "semester": detected_sem or default_sem or 5,
                            "department": detected_dept or default_dept or "IT"
                        })
            continue

        # Check for space / tab delimited format:
        # e.g.: 1. 3150702 Operating Systems 4 0 2 5 or 1 DI05016011 Artificial Intelligence 3 0 2 4
        m = re.match(r'^(?:(?:Sr\.?\s*No\.?|\d{1,2}[\.\)]?)\s+)?((?=[A-Za-z0-9]*\d)[A-Za-z0-9]{5,12})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+.*)?$', line)
        if m:
            code = m.group(1).strip().upper()
            title = m.group(2).strip()
            l_hrs = int(m.group(3))
            t_hrs = int(m.group(4))
            p_hrs = int(m.group(5))
            credits = int(m.group(6))

            # Exclude false positives like GUJARAT, MARKS, etc.
            if code in ['COURSE', 'SUBJECT', 'CATEGORY', 'THEORY', 'SRNO', 'MARKS', 'GUJARAT', 'TOTAL']:
                continue
            if len(title) < 2 or title.lower() in ['course title', 'subject name']:
                continue

            if code not in seen_codes:
                seen_codes.add(code)
                subjects.append({
                    "code": code,
                    "name": title,
                    "lectureHours": l_hrs,
                    "tutorialHours": t_hrs,
                    "labHours": p_hrs,
                    "hasLab": p_hrs > 0,
                    "credits": credits,
                    "semester": detected_sem or default_sem or 5,
                    "department": detected_dept or default_dept or "IT"
                })

    return detected_sem, detected_dept, subjects

def parse_syllabus_file(file_bytes, filename, default_sem=None, default_dept=None):
    """
    Main entry point for syllabus file parsing. Supports PDF, Excel (.xlsx, .xls), CSV, and text.
    """
    filename_lower = filename.lower()
    subjects = []
    detected_sem = default_sem
    detected_dept = default_dept

    if filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls'):
        subjects = extract_from_excel(file_bytes, filename)
    elif filename_lower.endswith('.csv'):
        subjects = extract_from_csv(file_bytes)
    elif filename_lower.endswith('.pdf'):
        if b'%PDF' in file_bytes[:1024]:
            text = extract_text_from_pdf(file_bytes)
            if not text.strip():
                text = file_bytes.decode('utf-8', errors='ignore')
        else:
            text = file_bytes.decode('utf-8', errors='ignore')
        detected_sem, detected_dept, subjects = parse_gtu_syllabus_text(text, default_sem, default_dept, filename=filename)
    else:
        # Plain text or other format
        text = file_bytes.decode('utf-8', errors='ignore')
        detected_sem, detected_dept, subjects = parse_gtu_syllabus_text(text, default_sem, default_dept, filename=filename)

    # Ensure semester and department are populated
    for s in subjects:
        if not s.get('semester') and detected_sem:
            s['semester'] = detected_sem
        if not s.get('department') and detected_dept:
            s['department'] = detected_dept

    return detected_sem, detected_dept, subjects
