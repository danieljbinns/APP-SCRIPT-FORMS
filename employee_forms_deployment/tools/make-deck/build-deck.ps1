# Build-Deck.ps1
param()

$sopDir  = "P:\Repos\github\danieljbinns\APP SCRIPT FORMS\employee_forms_deployment\docs\sop"
$outFile = "$sopDir\Employee-Portal-Training-Deck.pptx"

function rgb([int]$r,[int]$g,[int]$b){ return [long]($b*65536 + $g*256 + $r) }

$RED    = rgb 190  30  45
$DARK   = rgb  22  22  34
$WHITE  = rgb 255 255 255
$GRAY   = rgb 200 200 210
$BLUE   = rgb 100 180 255
$ACCENT = rgb 240  80  80

Write-Host "Starting PowerPoint COM..."
$app  = New-Object -ComObject PowerPoint.Application
$app.Visible = -1
$pres = $app.Presentations.Add(-1)
$pres.PageSetup.SlideWidth  = 960
$pres.PageSetup.SlideHeight = 540

function New-Slide([int]$layout){ return $pres.Slides.Add($pres.Slides.Count+1,$layout) }

function Set-Bg($s,[long]$c){
    $s.FollowMasterBackground = 0   # use slide-level bg, not master
    $s.Background.Fill.ForeColor.RGB = $c
    $s.Background.Fill.BackColor.RGB = $c
    $s.Background.Fill.Solid()
}

function Color-Range($r,[long]$c){
    $r.Font.Color.RGB = $c
    for($j=1; $j -le $r.Runs().Count; $j++){
        $r.Runs($j).Font.Color.RGB = $c
    }
}

function Set-Title($s,$t,[long]$c,[int]$sz){
    $r = $s.Shapes.Title.TextFrame.TextRange
    $r.Text = $t
    $r.Font.Bold = -1
    $r.Font.Size = $sz
    Color-Range $r $c
}

function Set-Body($s,$t,[long]$c,[int]$sz){
    $ph = $s.Shapes.Placeholders(2)
    $ph.TextFrame.WordWrap  = -1
    $ph.TextFrame2.AutoSize = 2   # msoAutoSizeTextToFitShape — shrink text to fit
    $r = $ph.TextFrame.TextRange
    $r.Text = $t
    $r.Font.Size = $sz
    Color-Range $r $c
    # Disable bullets; add SpaceBefore on section header lines (end with colon)
    for($p=1; $p -le $r.Paragraphs().Count; $p++){
        $para = $r.Paragraphs($p)
        $para.ParagraphFormat.Bullet.Visible = 0
        if($para.Text.Trim() -match ':$' -and $p -gt 1){
            $para.ParagraphFormat.SpaceBefore = 10
        }
    }
}

# ---- Slide 1: Title -------------------------------------------------------
$s = New-Slide 1
Set-Bg $s $DARK
$s.Shapes.Title.TextFrame.TextRange.Text = "TEAM Group Employee Portal"
$s.Shapes.Title.TextFrame.TextRange.Font.Bold = -1
$s.Shapes.Title.TextFrame.TextRange.Font.Size = 44
Color-Range $s.Shapes.Title.TextFrame.TextRange $WHITE
$s.Shapes.Placeholders(2).TextFrame2.AutoSize = 2
$s.Shapes.Placeholders(2).TextFrame.TextRange.Text = "Manager Training Guide  |  2026"
$s.Shapes.Placeholders(2).TextFrame.TextRange.Font.Size = 24
Color-Range $s.Shapes.Placeholders(2).TextFrame.TextRange $GRAY
Write-Host "Slide 1 done"

# ---- Slide 2: What Is the Portal ------------------------------------------
$s = New-Slide 2
Set-Bg $s $DARK
Set-Title $s "What Is the Employee Portal?" $ACCENT 36
$body2 = "A Google Apps Script system that automates paperwork across every employee lifecycle event.`n" +
"REPLACES:`n" +
"  - Manual emails and text chains between managers and HR/IT`n" +
"  - Untracked spreadsheet entries and verbal handoffs`n" +
"HOW IT WORKS:`n" +
"  - ~50 managers submit requests through guided web forms`n" +
"  - Each step auto-notifies the right person once the previous step is done`n" +
"  - The system tracks every open item -- nothing falls through`n" +
"FOUR SUPPORTED EVENTS:`n" +
"  1. New employee joining the company`n" +
"  2. Existing employee needs additional access or equipment`n" +
"  3. Employee leaving (End of Employment)`n" +
"  4. Employee changing role, site, manager, or classification"
Set-Body $s $body2 $GRAY 17
Write-Host "Slide 2 done"

# ---- Slide 3: Sequential Gating -------------------------------------------
$s = New-Slide 2
Set-Bg $s $DARK
Set-Title $s "How It Works: Sequential Gating" $ACCENT 36
$body3 = "Each step is locked until the previous actor completes their task.`n" +
"THE CHAIN:`n" +
"  1  Manager submits a request -- ticket created in the system`n" +
"  2  First actor gets an email with a direct link to their action form`n" +
"  3  They complete their step -- system records the result`n" +
"  4  Next actor is notified automatically -- chain continues`n" +
"  5  Ticket closes when all steps are done`n" +
"FOR MANAGERS:`n" +
"  - No follow-up emails needed -- the system handles all notifications`n" +
"  - Dashboard shows exactly which step is waiting if something stalls`n" +
"  - Routing is automatic (hourly vs salary, access vs no access)`n" +
"  - Every step is timestamped and auditable"
Set-Body $s $body3 $GRAY 17
Write-Host "Slide 3 done"

# ---- Slide 4: The Four Workflows (navigation) ------------------------------
$s4 = New-Slide 2
Set-Bg $s4 $DARK
Set-Title $s4 "The Four Workflows" $ACCENT 36
$body4 = "Click a workflow name below to open its full SOP guide.`n" +
"New Employee Request`n" +
"  Hiring a new employee (hourly or salary). ID setup, HR verification,`n" +
"  IT access, specialists, and 30/60/90 review.`n" +
"System and Equipment Request`n" +
"  Existing employee needs access or equipment. No HR gate --`n" +
"  goes straight to IT Confirmation then IT Setup.`n" +
"End of Employment (EOE)`n" +
"  Employee leaving. HR approval gate for terminations.`n" +
"  System access removal, Google offboarding, equipment return.`n" +
"Status and Position Change`n" +
"  Role, site, manager, or classification change. HR approval required.`n" +
"  New access provisioned and old access removed in one request."
Set-Body $s4 $body4 $GRAY 16

# Hyperlink the four title lines to their PDF files
$linkMap = @{
    "New Employee Request"          = "$sopDir\new-hire-submitter.pdf"
    "System and Equipment Request"  = "$sopDir\equipment-request-submitter.pdf"
    "End of Employment (EOE)"       = "$sopDir\termination-submitter.pdf"
    "Status and Position Change"    = "$sopDir\status-change-submitter.pdf"
}

$ph = $s4.Shapes.Placeholders(2)
$tr = $ph.TextFrame.TextRange
for($i = 1; $i -le $tr.Paragraphs().Count; $i++){
    $pt = $tr.Paragraphs($i).Text.Trim()
    foreach($key in $linkMap.Keys){
        if($pt -eq $key){
            $tr.Paragraphs($i).ActionSettings(1).Hyperlink.Address = $linkMap[$key]
            $tr.Paragraphs($i).Font.Color.RGB = $BLUE
            $tr.Paragraphs($i).Font.Underline = -1
            $tr.Paragraphs($i).Font.Bold = -1
        }
    }
}
Write-Host "Slide 4 done"

# ---- Slide 5: New Employee Request ----------------------------------------
$s = New-Slide 2
Set-Bg $s $DARK
Set-Title $s "New Employee Request -- Overview" $ACCENT 34
$body5 = "Who: Manager or supervisor of the incoming employee`n" +
"When: Before or on the employee's first day`n" +
"ROUTING AT SUBMISSION:`n" +
"  - Salary? Triggers JR title assignment and 30/60/90 review`n" +
"  - System/equipment access? Triggers IT Confirmation gate`n" +
"  - No access needed? Skips IT steps entirely`n" +
"STEPS:`n" +
"  1. ID Setup          Employee ID, SiteDocs Worker, DSS Training account`n" +
"  2. Safety Onboarding SiteDocs locations and DSS learning paths`n" +
"  3. HR Verification   Cross-check name, title, manager, ADP ID`n" +
"  4. IT Confirmation   Reviews system access scope (if access requested)`n" +
"  5. IT Setup          Google account, computer, phone, BOSS provisioned`n" +
"  6. Specialists       Credit card, business cards, Fleetio, Jonas (parallel)`n" +
"  7. 30/60/90 Review   Salary employees only (parallel)"
Set-Body $s $body5 $GRAY 16
Write-Host "Slide 5 done"

# ---- Slide 6: System & Equipment Request ----------------------------------
$s = New-Slide 2
Set-Bg $s $DARK
Set-Title $s "System and Equipment Request -- Overview" $ACCENT 34
$body6 = "Who: Manager of an existing employee`n" +
"When: Any time an employee needs new system access or equipment`n" +
"USE THIS FORM WHEN:`n" +
"  - Employee moves to a new role and needs BOSS access for new committees`n" +
"  - Existing employee needs a Google account for the first time`n" +
"  - Equipment is being issued to a current employee`n" +
"STEPS:`n" +
"  1. IT Confirmation  Reviews and approves the access scope`n" +
"  2. IT Setup         Google account, computer, BOSS, systems provisioned`n" +
"  3. Specialists      Credit card, Jonas, Fleetio, business cards (parallel)`n" +
"No HR gate. No ID Setup or Safety step. Fastest path for access changes."
Set-Body $s $body6 $GRAY 16
Write-Host "Slide 6 done"

# ---- Slide 7: End of Employment ------------------------------------------
$s = New-Slide 2
Set-Bg $s $DARK
Set-Title $s "End of Employment (EOE) -- Overview" $ACCENT 34
$body7 = "Who: Manager of the departing employee`n" +
"When: As soon as the departure is known`n" +
"DEPARTURE TYPES:`n" +
"  - Resignation / Retirement  No HR approval -- goes to offboarding directly`n" +
"  - Termination               HR must approve before offboarding begins`n" +
"CAPTURED AT SUBMISSION:`n" +
"  - Last day worked and final pay date`n" +
"  - Systems to remove access from (ADP, BOSS, Google, Jonas, SiteDocs...)`n" +
"  - Google offboarding options (Drive transfer, email forwarding)`n" +
"  - Equipment to be returned (computer, phone, tablet, vehicle, card)`n" +
"  - Direct reports and whether reassignment is needed`n" +
"STEPS:`n" +
"  1. HR Approval (terminations only) -- approves or rejects with notes`n" +
"  2. IT Offboarding -- access removal, Google suspension or transfer`n" +
"  3. Equipment Collection -- items tracked and confirmed returned"
Set-Body $s $body7 $GRAY 16
Write-Host "Slide 7 done"

# ---- Slide 8: Status / Position Change -----------------------------------
$s = New-Slide 2
Set-Bg $s $DARK
Set-Title $s "Status and Position Change -- Overview" $ACCENT 34
$body8 = "Who: Manager of the employee whose role or situation is changing`n" +
"When: Before the change takes effect whenever possible`n" +
"CHANGE TYPES (check all that apply):`n" +
"  - Site Transfer          New site and department sub-section appears`n" +
"  - Position Change        New job title and JR title fields appear`n" +
"  - Classification Change  Hourly-to-Salary toggle with supporting details`n" +
"  - Manager Change         New manager email field appears`n" +
"ALSO CAPTURED:`n" +
"  - New system / equipment access to provision`n" +
"  - Equipment to return (computer, phone, tablet, vehicle, card)`n" +
"  - Access to remove (ADP, BOSS, CAA, Google, Jonas, SiteDocs...)`n" +
"  - Handling of any direct reports`n" +
"STEPS:`n" +
"  1. HR Approval   Reviews all changes, confirms new title and JR title`n" +
"  2. IT + Specialists  New access provisioned, old access revoked (parallel)"
Set-Body $s $body8 $GRAY 16
Write-Host "Slide 8 done"

# ---- Save ----------------------------------------------------------------
Write-Host "Saving presentation..."
$pres.SaveAs($outFile)
$pres.Close()
$app.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
[System.GC]::Collect()
Write-Host "DONE: $outFile"
