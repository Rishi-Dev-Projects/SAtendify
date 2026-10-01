import time

# Simple in-memory cache for safe, non-sensitive, semi-static metadata
# Eliminates repeated full collection scans across Firestore requests
_CACHE = {}

def get_cached(key, ttl=60):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry['ts'] < ttl):
        return entry['data']
    return None

def set_cached(key, data):
    _CACHE[key] = {
        'data': data,
        'ts': time.time()
    }

def invalidate_cache(prefix=None):
    if prefix:
        for k in list(_CACHE.keys()):
            if k.startswith(prefix):
                _CACHE.pop(k, None)
    else:
        _CACHE.clear()

def get_cached_subjects(db, ttl=90):
    """
    Returns a dictionary of all curriculum subjects {doc.id: data}.
    Cached in memory to avoid full-collection streaming on every timetable / attendance request.
    """
    cached = get_cached('all_subjects', ttl)
    if cached is not None:
        return cached

    subs_map = {doc.id: doc.to_dict() for doc in db.collection('subjects').stream()}
    set_cached('all_subjects', subs_map)
    return subs_map

def get_cached_faculty_names(db, ttl=120):
    """
    Returns a mapping of {faculty_uid: faculty_name}.
    Avoids streaming the entire users collection (students + faculty) just to resolve professor names.
    """
    cached = get_cached('faculty_names', ttl)
    if cached is not None:
        return cached

    fac_map = {}
    docs = db.collection('users').where('role', 'in', ['faculty', 'hod']).select(['name']).stream()
    for doc in docs:
        fac_map[doc.id] = doc.to_dict().get('name', 'Professor')
    set_cached('faculty_names', fac_map)
    return fac_map

def get_cached_semester_config(db, ttl=120):
    """
    Returns semester division configurations.
    """
    cached = get_cached('semester_config', ttl)
    if cached is not None:
        return cached

    default_cfg = { "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2 }
    try:
        doc = db.collection('settings').document('semester_config').get()
        if doc.exists:
            cfg = doc.to_dict()
            set_cached('semester_config', cfg)
            return cfg
    except Exception:
        pass
    set_cached('semester_config', default_cfg)
    return default_cfg
