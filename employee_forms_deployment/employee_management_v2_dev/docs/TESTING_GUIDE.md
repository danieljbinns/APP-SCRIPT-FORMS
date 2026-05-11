# V1 vs V2 Architecture - Testing & Comparison Guide

## Quick Test Plan

### Step 1: Deploy V2

1. Go to <https://script.google.com>
2. Create new project: "Employee Management V2"
3. Copy ALL files from `employee_management_v2/`
4. Deploy as Web App
5. **Copy deployment URL**

### Step 2: Side-by-Side Test

Run the same workflow in both architectures and time each step:

| Step | V1 (5 projects) | V2 (1 project) | Notes |
|:-----|:----------------|:---------------|:------|
| 1. Load Initial Request form | | | First load (cold start) |
| 2. Submit Initial Request | | | |
| 3. Load ID Setup form | | | |
| 4. Submit ID Setup (Salary) | | | Should route to HR |
| 5. Load HR Verification | | | |
| 6. Submit HR Verification | | | Should route to IT |
| 7. Load IT Setup | | | |
| 8. Submit IT Setup | | | Should trigger specialists |
| **TOTAL TIME** | | | |

---

## Performance Expectations

### Cold Start (First Load)

- **V1**: ~2 seconds per form × 5 forms = 10 seconds total
- **V2**: ~3 seconds (all code loads once)

**Winner: V2** (saves ~7 seconds)

### Warm Execution (Subsequent Loads)

- **V1**: ~500ms + library call overhead (~200ms) = ~700ms
- **V2**: ~300ms (direct function calls)

**Winner: V2** (2x faster)

### Email Sending

- **V1**: `Lib.sendFormEmail()` (cross-project call)
- **V2**: `sendFormEmail()` (same project)

**Winner: V2** (eliminates cross-project overhead)

---

## Maintainability Test

### Add New Form URL

**V1 Process:**

1. Edit `new_employee_request/Config.gs`
2. Edit `employee_id_setup/Config.gs`
3. Edit `hr_verification/Config.gs`
4. Edit `it_setup/Config.gs`
5. Edit `specialist_placeholder/Config.gs`
6. Deploy 5 separate projects

**V2 Process:**

1. Edit `employee_management_v2/Config.gs` (ONE FILE)
2. Deploy 1 project

**Time saved: ~10 minutes per update**

---

## URL Comparison

### V1 URLs (5 different base URLs)

```
Initial Request:    https://.../AKfycb...ABC/exec
ID Setup:           https://.../AKfycb...DEF/exec?id=REQ_123
HR Verification:    https://.../AKfycb...GHI/exec?id=REQ_123
IT Setup:           https://.../AKfycb...JKL/exec?id=REQ_123
Specialist:         https://.../AKfycb...MNO/exec?id=REQ_123&dept=adp
```

### V2 URLs (1 base URL with form parameter)

```
Initial Request:    https://.../AKfycb...XYZ/exec?form=initial_request
ID Setup:           https://.../AKfycb...XYZ/exec?form=id_setup&id=REQ_123
HR Verification:    https://.../AKfycb...XYZ/exec?form=hr_verification&id=REQ_123
IT Setup:           https://.../AKfycb...XYZ/exec?form=it_setup&id=REQ_123
Specialist:         https://.../AKfycb...XYZ/exec?form=specialist&id=REQ_123&dept=adp
```

**Benefit:** One deployment URL to manage

---

## Debugging Comparison

### V1 (5 Projects)

- Bug in email logic? Check 5 different `Code.gs` files
- Which project is failing? Check logs in 5 places
- Update validation? Update library, update 5 projects

### V2 (1 Project)

- Bug in email logic? Check `EmailUtils.gs` (one place)
- Which form is failing? Check logs in one project
- Update validation? Update `ValidationUtils.gs` (one file)

---

## Risk Assessment

| Risk | V1 | V2 |
|:-----|:---|:---|
| Deployment breaks one form | Low (isolated) | Medium (shared code) |
| Debugging complexity | High (5 projects) | Low (1 project) |
| Config drift | High (5 files) | None (1 file) |
| Library version issues | Medium | None (no library) |
| File size limits | None (5 small projects) | None (well under 50MB limit) |

---

## Recommendation

**Use V2 if:**

- You value maintainability (fewer files to update)
- You want faster execution (no library overhead)
- You plan to add more workflows (Status Change will reuse forms)
- You prefer centralized debugging

**Use V1 if:**

- You need isolated deployments per form
- You have concerns about single point of failure
- You prefer smaller individual projects

**My verdict: V2 is the better long-term architecture for a multi-workflow system.**

---

## Next Steps

1. ✅ Deploy V2 and test one complete workflow
2. ✅ Compare load times and execution speed
3. ✅ If satisfactory, migrate all workflows to V2
4. ✅ Archive V1 projects (don't delete yet)
5. ✅ Update email templates to use V2 URLs
