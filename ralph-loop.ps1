# HubbleWave Ralph Loop - Windows PowerShell Version
# Place this file in your project root and run: powershell -ExecutionPolicy Bypass -File .\ralph-loop.ps1

$MaxIterations = 200
$Iteration = 0
$CompletionPromise = "ALL_PHASES_COMPLETE"
$LogFile = "ralph-loop-log.txt"

# Initial prompt that includes full context
$InitialPrompt = @"
You are executing the HubbleWave Ralph Loop autonomously. 

CRITICAL INSTRUCTIONS:
1. Read hubblewave-ralph-loop.md in the project root
2. Read CLAUDE.md for the Master Canon
3. Follow the Phase Implementation Protocol exactly
4. After EACH task: run build, check errors, fix if needed, proceed
5. Do NOT stop or ask for input - work autonomously
6. Output <promise>PHASE_N_COMPLETE</promise> after each phase
7. Output <promise>ALL_PHASES_COMPLETE</promise> when done

START NOW:
- If this is iteration 0: Begin with Phase 0 (Review & Stabilize)
- Otherwise: Continue from where you left off

Check git status and build output to determine current state, then proceed.
"@

# Continuation prompt for subsequent iterations
$ContinuePrompt = @"
CONTINUE RALPH LOOP AUTONOMOUSLY.

DO NOT STOP. DO NOT ASK QUESTIONS. WORK CONTINUOUSLY.

1. Check current state (git status, build output, last completed task)
2. Identify next task from hubblewave-ralph-loop.md
3. Implement it
4. Run validation (build, lint, test)
5. Fix any errors
6. Proceed to next task

If you completed a phase, output <promise>PHASE_N_COMPLETE</promise>
When ALL phases done, output <promise>ALL_PHASES_COMPLETE</promise>

CONTINUE NOW.
"@

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "HUBBLEWAVE RALPH LOOP - STARTING" -ForegroundColor Cyan
Write-Host "Max Iterations: $MaxIterations" -ForegroundColor Cyan
Write-Host "Completion Promise: $CompletionPromise" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Initialize log
"Ralph Loop Started: $(Get-Date)" | Out-File -FilePath $LogFile

while ($Iteration -lt $MaxIterations) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "ITERATION $Iteration / $MaxIterations" -ForegroundColor Yellow
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
    
    # Log iteration
    "Iteration $Iteration started: $(Get-Date)" | Out-File -FilePath $LogFile -Append
    
    # Choose prompt based on iteration
    if ($Iteration -eq 0) {
        $Prompt = $InitialPrompt
    } else {
        $Prompt = $ContinuePrompt
    }
    
    # Run Claude and capture output
    try {
        $Output = claude -p $Prompt --max-turns 50 2>&1
        $OutputString = $Output | Out-String
        
        # Log output
        "--- Output ---" | Out-File -FilePath $LogFile -Append
        $OutputString | Out-File -FilePath $LogFile -Append
        
        # Check for completion
        if ($OutputString -match "<promise>ALL_PHASES_COMPLETE</promise>") {
            Write-Host ""
            Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
            Write-Host "✅ ALL PHASES COMPLETE!" -ForegroundColor Green
            Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
            "COMPLETED: $(Get-Date)" | Out-File -FilePath $LogFile -Append
            exit 0
        }
        
        # Check for phase completions
        if ($OutputString -match "<promise>PHASE_(\d)_COMPLETE</promise>") {
            $PhaseNum = $Matches[1]
            Write-Host "✅ Phase $PhaseNum completed!" -ForegroundColor Green
            "Phase $PhaseNum completed: $(Get-Date)" | Out-File -FilePath $LogFile -Append
        }
        
        # Check for blocked tasks
        if ($OutputString -match "<promise>TASK_BLOCKED:(.+)</promise>") {
            $BlockedTask = $Matches[1]
            Write-Host "⚠️ Task blocked: $BlockedTask" -ForegroundColor Yellow
            "Task blocked: $BlockedTask at $(Get-Date)" | Out-File -FilePath $LogFile -Append
        }
        
    } catch {
        Write-Host "Error in iteration $Iteration : $_" -ForegroundColor Red
        "Error: $_ at $(Get-Date)" | Out-File -FilePath $LogFile -Append
        Start-Sleep -Seconds 5
    }
    
    $Iteration++
    
    # Small delay between iterations to prevent rate limiting
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
Write-Host "Max iterations ($MaxIterations) reached without completion" -ForegroundColor Red
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
"Max iterations reached: $(Get-Date)" | Out-File -FilePath $LogFile -Append
