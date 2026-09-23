# The flow, in pictures

Three diagrams: George's hourly onboarding through the door, the JR one-node swap, and what the door is.

---

## 1. Hourly onboarding — George's flow

```mermaid
flowchart TD
  H0{{"👤 Manager submits<br/>Initial Request in the portal"}} --> F0["Forms mints the<br/>Internal Employee ID"]
  F0 --> E1[/"Email: ID Setup Required<br/>→ grp.forms.idsetup (George)<br/>Request ID · Internal ID"/]
  F0 --> E2[/"Email: Request Submitted<br/>→ requester"/]

  subgraph G["George's n8n workflow"]
    T1["Gmail trigger<br/>subject: ID Setup Required"] --> P1["Parse Request ID<br/>+ Internal ID"]
    P1 --> W1[["Forms · Get Workflow (PROD)<br/>request + employeeId"]]
    W1 --> D1["Draft SiteDocs / DSS / BOSS<br/><i>his real calls go here</i>"]
    D1 --> A1[/"Approval email to George"/]
    A1 --> H1{{"👤 George clicks Approve"}}
    H1 --> R1["Do the real setup<br/><i>SiteDocs · DSS · BOSS — his side</i>"]
    R1 --> W2[["Forms · Submit ID Setup (PROD)"]]
  end
  E1 --> T1

  W2 --> F1["Forms: step → HR Verification Needed<br/>emails HR · creates Safety task"]
  F1 --> W3[["Forms · Close Task (PROD)<br/>when his part of a task is done"]]

  style F0 fill:#1e3a5f,color:#fff
  style W1 fill:#14532d,color:#fff
  style W2 fill:#14532d,color:#fff
  style W3 fill:#14532d,color:#fff
  style E1 fill:#14532d,color:#fff
```

**Green is what this project adds:** the id in the email, and named calls into Forms. Everything inside the
dashed box is George's; the only things he calls are the green boxes.

---

## 2. JR — one node changes

```mermaid
flowchart LR
  subgraph BEFORE["BEFORE"]
    A1[Apply Duty Changes] --> A2["Mark Portal JR Complete<br/>httpRequest"]
    A2 -- "shared password<br/>in the body" --> A3(["/exec web address<br/>anonymous"])
  end
  subgraph AFTER["AFTER"]
    B1[Apply Duty Changes] --> B2["Forms · Close JR Task (EFX)<br/>executeWorkflow"]
    B2 --> B3[["Forms · Close JR Task (PROD)"]]
    B3 --> B4["EFX Router"]
    B4 -- "service account<br/>as efx-bot" --> B5(["Apps Script<br/>Execution API"])
  end
  style A2 fill:#7f1d1d,color:#fff
  style A3 fill:#7f1d1d,color:#fff
  style B2 fill:#14532d,color:#fff
  style B3 fill:#14532d,color:#fff
```

Everything upstream of that node — Gmail trigger, parsing, tracker, approval, BOSS Lambda — is untouched.

---

## 3. What the door is

```mermaid
flowchart LR
  G1["Forms · Submit ID Setup"] --> R
  G2["Forms · Close JR Task"] --> R
  G3["Forms · Get Workflow"] --> R
  G4["Forms · List Tasks"] --> R
  G5["Forms · Close Task"] --> R
  R["EFX · Router (PROD)<br/><i>one shared sub-workflow</i>"]
  R -- "SA impersonating efx-bot" --> API(["Execution API<br/>scripts/{script id}:run"])
  API --> F["Employee Forms<br/><i>all the rules live here</i>"]
  F --> SS[(Spreadsheet)]
  F --> EM[/Emails/]
  style R fill:#1e3a5f,color:#fff
  style F fill:#1e3a5f,color:#fff
```

n8n holds no business rules and never writes to the spreadsheet. When the rules change, nothing in n8n changes.

| Symbol | Meaning |
|---|---|
| 👤 | A human acts |
| `[[ ]]` | A shared sub-workflow George calls by id |
| Green | Added by this project |
| Red | Removed: the password-and-URL path |
