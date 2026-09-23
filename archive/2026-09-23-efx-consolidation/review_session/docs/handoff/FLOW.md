# The flow, in pictures

Three diagrams: what changes, the whole JR chain, and what the new door actually is.

---

## 1. The change — one node

```mermaid
flowchart LR
  subgraph BEFORE["BEFORE — today"]
    A1[Apply Duty Changes] --> A2["Mark Portal JR Complete<br/>httpRequest"]
    A2 -- "shared password<br/>in the body" --> A3(["/exec web address<br/>anonymous, no identity"])
    A3 --> A4[(Employee Forms<br/>spreadsheet)]
  end

  subgraph AFTER["AFTER — the change"]
    B1[Apply Duty Changes] --> B2["Mark Portal JR Complete<br/>executeWorkflow"]
    B2 --> B3["Forms · Close JR Task"]
    B3 --> B4["EFX Router"]
    B4 -- "Google service account<br/>acting as efx-bot" --> B5(["Apps Script<br/>Execution API"])
    B5 --> B6[(Employee Forms<br/>spreadsheet)]
  end

  style A2 fill:#7f1d1d,color:#fff
  style A3 fill:#7f1d1d,color:#fff
  style B2 fill:#14532d,color:#fff
  style B3 fill:#14532d,color:#fff
  style B4 fill:#14532d,color:#fff
```

**Red is what goes away:** a published address anyone can reach, gated only by a password, with no
record of who called it. **Green is what replaces it:** an identified call over a permanent id.

Everything to the left of that node is unchanged.

---

## 2. The whole JR chain

Three workflows, two human clicks. Only the last box on the right is new.

```mermaid
flowchart TD
  E0([New hire completes IT Setup<br/>in Employee Forms]) --> E1[/"Forms emails:<br/>'JR Assignment — Name'"/]

  subgraph W1["JR 1 · Assignment Automation"]
    T1["Gmail trigger<br/>subject:'JR Assignment' is:unread"] --> P1[Parse the email]
    P1 --> M1[Find the JR template<br/>in the Index sheet]
    M1 --> C1[Copy template<br/>+ write the duties]
    C1 --> L1[Log a row<br/>in the tracker]
    L1 --> X1[/"Email the manager<br/>for review"/]
  end
  E1 --> T1

  H1{{"👤 Manager clicks<br/>'Looks good'"}}
  X1 --> H1

  subgraph W2["JR 2 · Manager Response"]
    R2[Find the row<br/>by token] --> S2[Mark Completed<br/>+ move the file]
    S2 --> X2[/"Email: Ready for BOSS"/]
  end
  H1 --> R2

  H2{{"👤 Click<br/>'Assign in BOSS'"}}
  X2 --> H2

  subgraph W3["JR 3 · BOSS Assignment"]
    V3[Look up the<br/>BOSS job id] --> B3["Assign in BOSS<br/>via Lambda"]
    B3 --> D3[Apply duty changes]
    D3 --> N3["Mark Portal JR Complete"]
  end
  H2 --> V3

  N3 --> Z3[["Forms · Close JR Task<br/>→ Router → Forms"]]
  Z3 --> Z4[(Task closed,<br/>Closed By recorded)]

  style N3 fill:#14532d,color:#fff
  style Z3 fill:#14532d,color:#fff
  style Z4 fill:#14532d,color:#fff
```

---

## 3. What the "door" actually is

The Router is one shared sub-workflow. Every capability is a thin wrapper over it — so adding the
next one costs a wrapper, not a new endpoint, new password and new deployment.

```mermaid
flowchart LR
  G1["Forms · Close JR Task"] --> R
  G2["Forms · Create Initial Request"] --> R
  G3["Forms · Submit ID Setup"] --> R
  G4["…24 more wrappers"] --> R

  R["EFX Router<br/><i>one shared sub-workflow</i>"]
  R -- "service account,<br/>impersonating efx-bot" --> API(["Apps Script Execution API<br/>scripts/{permanent id}:run"])
  API --> F["Employee Forms<br/><i>all the rules live here</i>"]
  F --> SS[(Spreadsheet)]
  F --> EM[/Emails to the right teams/]

  style R fill:#1e3a5f,color:#fff
  style F fill:#1e3a5f,color:#fff
```

**The point of the shape:** n8n holds no business rules. Who may do what, what a valid hire looks
like, which team gets emailed, how employee numbers are issued — all of that stays in Forms. When
those rules change, nothing in n8n changes.

---

## Reading the arrows

| Symbol | Meaning |
|---|---|
| 👤 | A human clicks a button in an email |
| Green | New — the part this project adds |
| Red | Removed — the password-and-URL path |
| `[( )]` | Data at rest: the spreadsheet |
| `[/ /]` | An email leaving the system |
