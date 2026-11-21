; OpenDeath 1.0.4 setup wizard
; Installs the packaged desktop app per user, requires Cloudflare WARP first (the default route),
; checks for OpenCode Desktop, and optionally installs other VPN clients from their official winget packages.

Unicode true

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"
!include "x64.nsh"

!define PRODUCT     "OpenDeath"
!define VERSION     "1.0.4"
!define PUBLISHER   "saintkyle"
!define APPID       "dev.opendeath.desktop"
!define APP_EXE     "opendeath.exe"
!define APP_SRC     "C:\od\app\dist\desktop\app"
!define APP_ICON    "C:\od\app\packages\desktop\icons\prod\icon.ico"
!define ART         "C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507\installer\assets"
!define OUT_FILE    "C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507\release\OpenDeath-Setup-${VERSION}.exe"
; electron-updater downloads into this folder and runs the installer from it with /S.
!define UPDATER_CACHE "$LOCALAPPDATA\@opencodedesktop-updater\pending"

Name "${PRODUCT} ${VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\OpenDeath"
InstallDirRegKey HKCU "Software\OpenDeath" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
SetDatablockOptimize on
CRCCheck on
BrandingText "${PRODUCT} ${VERSION}"
Caption "${PRODUCT} ${VERSION} Setup"
Icon "${APP_ICON}"
UninstallIcon "${APP_ICON}"

VIProductVersion "1.0.4.0"
VIAddVersionKey /LANG=1033 "ProductName"     "${PRODUCT}"
VIAddVersionKey /LANG=1033 "ProductVersion"  "${VERSION}"
VIAddVersionKey /LANG=1033 "FileVersion"     "1.0.4.0"
VIAddVersionKey /LANG=1033 "FileDescription" "${PRODUCT} Setup"
VIAddVersionKey /LANG=1033 "CompanyName"     "${PUBLISHER}"
VIAddVersionKey /LANG=1033 "LegalCopyright"  "Copyright (C) 2026 ${PUBLISHER}"

!define MUI_ICON   "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!define MUI_ABORTWARNING
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${ART}\header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${ART}\welcome.bmp"
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT} ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "This wizard installs OpenDeath, a standalone desktop AI workspace with the Infinite network deck.$\r$\n$\r$\nCloudflare WARP is required: it is the default route and is put in place first.$\r$\n$\r$\nOpenDeath installs alongside OpenCode Desktop. It never launches, replaces, or modifies your OpenCode installation.$\r$\n$\r$\nClick Next to install WARP and check the prerequisites."
!define MUI_FINISHPAGE_TITLE "OpenDeath is ready"
!define MUI_FINISHPAGE_TEXT "OpenDeath ${VERSION} has been installed.$\r$\n$\r$\nClick Finish to launch opendeath.exe. Settings and chats are stored separately from OpenCode Desktop."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Launch OpenDeath"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchOpenDeath"

!insertmacro MUI_PAGE_WELCOME
Page custom PrereqPage PrereqLeave
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Var PrereqDialog
Var PrereqStatus
Var WarpStatus
Var PrereqOverride
Var PrereqLink
Var WarpInstall
Var PrereqCheck
Var WarpLink
Var WarpCheck
Var BoldFont
Var OpenCodeFound
Var WarpFound
; The version already on disk, so a silent run can tell an upgrade from a first install.
Var PriorVersion
; Set when the install should hand the app back to the user.
Var Relaunch

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "OpenDeath requires 64-bit Windows."
    Abort
  ${EndIf}
  SetShellVarContext current
  ReadRegStr $PriorVersion HKCU "Software\OpenDeath" "Version"
FunctionEnd

; electron-updater runs this installer from its download cache with /S; the finish page never shows, so the launch it
; normally offers has to happen here. An update always upgrades a version that is already on disk, which covers a cache
; path that differs by case; a first install stays quiet.
Function .onInstSuccess
  StrCpy $Relaunch "0"
  ${If} $EXEDIR == "${UPDATER_CACHE}"
    StrCpy $Relaunch "1"
  ${ElseIf} ${Silent}
  ${AndIf} $PriorVersion != ""
    StrCpy $Relaunch "1"
  ${EndIf}
  ${If} $Relaunch == "1"
    ExecShell "open" "$INSTDIR\${APP_EXE}"
  ${EndIf}
FunctionEnd

Function LaunchOpenDeath
  ExecShell "open" "$INSTDIR\${APP_EXE}"
FunctionEnd

Function DetectOpenCode
  StrCpy $OpenCodeFound "0"

  ${If} ${FileExists} "$LOCALAPPDATA\Programs\ai.opencode.desktop\OpenCode.exe"
    StrCpy $OpenCodeFound "1"
  ${EndIf}

  ${If} $OpenCodeFound == "0"
  ${AndIf} ${FileExists} "$PROGRAMFILES64\OpenCode\OpenCode.exe"
    StrCpy $OpenCodeFound "1"
  ${EndIf}

  ; Fall back to the per-user uninstall registry. The display name starts with "OpenCode".
  ${If} $OpenCodeFound == "0"
    StrCpy $R9 0
    ${Do}
      EnumRegKey $R8 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall" $R9
      ${If} $R8 == ""
        ${ExitDo}
      ${EndIf}
      ReadRegStr $R7 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R8" "DisplayName"
      StrCpy $R6 $R7 9
      ${If} $R6 == "OpenCode "
        StrCpy $OpenCodeFound "1"
        ${ExitDo}
      ${EndIf}
      IntOp $R9 $R9 + 1
    ${Loop}
  ${EndIf}
FunctionEnd

; WARP installs to a fixed folder and registers a "Cloudflare WARP" uninstall entry. Check the folder first, then the
; uninstall list for a custom path so a moved install still counts.
!macro WarpInRegistry HIVE VIEW
  ${If} $WarpFound == "0"
    SetRegView ${VIEW}
    StrCpy $R9 0
    ${Do}
      EnumRegKey $R8 ${HIVE} "Software\Microsoft\Windows\CurrentVersion\Uninstall" $R9
      ${If} $R8 == ""
        ${ExitDo}
      ${EndIf}
      ReadRegStr $R7 ${HIVE} "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R8" "DisplayName"
      StrCpy $R6 $R7 15
      ${If} $R6 == "Cloudflare WARP"
        StrCpy $WarpFound "1"
        ${ExitDo}
      ${EndIf}
      IntOp $R9 $R9 + 1
    ${Loop}
    SetRegView lastused
  ${EndIf}
!macroend

Function DetectWarp
  StrCpy $WarpFound "0"

  ${If} ${FileExists} "$PROGRAMFILES64\Cloudflare\Cloudflare WARP\warp-cli.exe"
    StrCpy $WarpFound "1"
  ${EndIf}

  ${If} $WarpFound == "0"
  ${AndIf} ${FileExists} "$PROGRAMFILES32\Cloudflare\Cloudflare WARP\warp-cli.exe"
    StrCpy $WarpFound "1"
  ${EndIf}

  !insertmacro WarpInRegistry HKLM 64
  !insertmacro WarpInRegistry HKCU 64
FunctionEnd

Function UpdatePrereqStatus
  ${If} $WarpFound == "1"
    ${NSD_SetText} $WarpStatus "WARP is installed. It is the default route.$\r$\nClick Next to continue."
    SetCtlColors $WarpStatus 0x157F3B 0xFFFFFF
  ${Else}
    ${NSD_SetText} $WarpStatus "WARP is required and was not found. Install it below, or from cloudflare.com/warp, then click Check again."
    SetCtlColors $WarpStatus 0xB1162A 0xFFFFFF
  ${EndIf}

  ${If} $OpenCodeFound == "1"
    ${NSD_SetText} $PrereqStatus "OpenCode Desktop detected."
    SetCtlColors $PrereqStatus 0x157F3B 0xFFFFFF
    EnableWindow $PrereqOverride 0
  ${Else}
    ${NSD_SetText} $PrereqStatus "OpenCode Desktop was not found. Install it from the official page, then click Check again."
    SetCtlColors $PrereqStatus 0xB1162A 0xFFFFFF
    EnableWindow $PrereqOverride 1
  ${EndIf}
FunctionEnd

Function PrereqCheckClick
  Call DetectOpenCode
  Call DetectWarp
  Call UpdatePrereqStatus
FunctionEnd

Function PrereqOpenClick
  ExecShell "open" "https://opencode.ai/desktop"
FunctionEnd

Function WarpCheckClick
  Call DetectWarp
  Call UpdatePrereqStatus
FunctionEnd

Function WarpOpenClick
  ExecShell "open" "https://www.cloudflare.com/warp/"
FunctionEnd

Function WarpInstallClick
  ; One install at a time: the button stays dark until winget returns.
  EnableWindow $WarpInstall 0
  EnableWindow $WarpCheck 0
  DetailPrint "Installing Cloudflare WARP from the official package..."
  nsExec::ExecToLog 'winget install --id Cloudflare.Warp --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity'
  Pop $0
  ${If} $0 != 0
    DetailPrint "winget returned $0. WARP may already be installed, or winget is unavailable."
  ${EndIf}
  Call DetectWarp
  Call UpdatePrereqStatus
  EnableWindow $WarpCheck 1
  EnableWindow $WarpInstall 1
FunctionEnd

!macro BoldLabel VAR X Y W H TEXT
  ${NSD_CreateLabel} ${X} ${Y} ${W} ${H} "${TEXT}"
  Pop ${VAR}
  SendMessage ${VAR} ${WM_SETFONT} $BoldFont 1
!macroend

Function PrereqPage
  !insertmacro MUI_HEADER_TEXT "Prerequisites" "Cloudflare WARP is installed first. OpenCode Desktop is also required."

  nsDialogs::Create 1018
  Pop $PrereqDialog
  ${If} $PrereqDialog == error
    Abort
  ${EndIf}

  CreateFont $BoldFont "Segoe UI" 9 700

  !insertmacro BoldLabel $0 0 0 100% 10u "Cloudflare WARP - required"
  ${NSD_CreateLabel} 0 12u 100% 22u ""
  Pop $WarpStatus

  ${NSD_CreateButton} 0 36u 70u 14u "Install WARP now"
  Pop $WarpInstall
  ${NSD_OnClick} $WarpInstall WarpInstallClick

  ${NSD_CreateButton} 74u 36u 44u 14u "Get WARP"
  Pop $WarpLink
  ${NSD_OnClick} $WarpLink WarpOpenClick

  ${NSD_CreateButton} 122u 36u 46u 14u "Check again"
  Pop $WarpCheck
  ${NSD_OnClick} $WarpCheck WarpCheckClick

  !insertmacro BoldLabel $0 0 56u 100% 10u "OpenCode Desktop - required"
  ${NSD_CreateLabel} 0 67u 100% 18u "OpenDeath runs on the OpenCode engine and shares its sign-in store. It keeps its own executable and data folder, and it never launches OpenCode."
  Pop $0

  ${NSD_CreateLabel} 0 86u 100% 22u ""
  Pop $PrereqStatus

  ${NSD_CreateButton} 0 110u 70u 14u "Open download page"
  Pop $PrereqLink
  ${NSD_OnClick} $PrereqLink PrereqOpenClick

  ${NSD_CreateButton} 74u 110u 46u 14u "Check again"
  Pop $PrereqCheck
  ${NSD_OnClick} $PrereqCheck PrereqCheckClick

  ${NSD_CreateCheckbox} 0 127u 100% 12u "Continue without OpenCode Desktop (advanced)"
  Pop $PrereqOverride
  ${NSD_Uncheck} $PrereqOverride

  Call DetectWarp
  Call DetectOpenCode
  Call UpdatePrereqStatus

  nsDialogs::Show
FunctionEnd

Function PrereqLeave
  Call DetectWarp
  Call DetectOpenCode

  ; WARP is required. When it is missing, setup makes one attempt from the official package before it lets the
  ; install proceed, so a machine never lands in the app without the default route in place.
  ${If} $WarpFound == "0"
    DetailPrint "Cloudflare WARP is required and was not found. Installing it now..."
    nsExec::ExecToLog 'winget install --id Cloudflare.Warp --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity'
    Pop $0
    Call DetectWarp
  ${EndIf}

  ${If} $WarpFound == "0"
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Cloudflare WARP is required and could not be installed.$\r$\n$\r$\nOpen the official download page now? Install WARP, then run this setup again." IDYES WarpPageLeave
    Abort
    WarpPageLeave:
      ExecShell "open" "https://www.cloudflare.com/warp/"
      Abort
  ${EndIf}

  ${If} $OpenCodeFound == "0"
    ${NSD_GetState} $PrereqOverride $0
    ${If} $0 != ${BST_CHECKED}
      MessageBox MB_YESNO|MB_ICONEXCLAMATION "OpenCode Desktop is required and was not found.$\r$\n$\r$\nOpen the official download page now? Install OpenCode Desktop, then run this setup again." IDYES PrereqOpenPage
      Abort
      PrereqOpenPage:
        ExecShell "open" "https://opencode.ai/desktop"
        Abort
    ${EndIf}
  ${EndIf}
FunctionEnd

!macro WingetInstall ID LABEL
  DetailPrint "Installing ${LABEL} from the official vendor package..."
  nsExec::ExecToLog 'winget install --id ${ID} --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity'
  Pop $0
  ${If} $0 == 0
    DetailPrint "${LABEL} installed successfully."
  ${Else}
    DetailPrint "${LABEL} was not installed (winget exit code $0)."
    DetailPrint "You can install ${LABEL} later from its official website."
  ${EndIf}
!macroend

Section "OpenDeath (required)" SecCore
  SectionIn RO

  ; Replace a running copy so the executable is not locked during the upgrade.
  nsExec::ExecToLog 'taskkill /F /IM ${APP_EXE} /T'
  Pop $0

  SetOutPath "$INSTDIR"
  File /r "${APP_SRC}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall OpenDeath.exe"

  WriteRegStr HKCU "Software\OpenDeath" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\OpenDeath" "Version" "${VERSION}"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "DisplayName" "${PRODUCT} ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "UninstallString" '"$INSTDIR\Uninstall OpenDeath.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "QuietUninstallString" '"$INSTDIR\Uninstall OpenDeath.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath" "NoRepair" 1

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\opendeath.exe" "" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\opendeath.exe" "Path" "$INSTDIR"
SectionEnd

Section "Cloudflare WARP (required)" SecWarp
  SectionIn RO

  ; The prerequisite page installs WARP before this point. This covers a silent upgrade, where every page is skipped
  ; and the RO section is the only thing that can still put the default route in place. An update must not start a
  ; winget install behind the user's back; a missing client is reported by the app's own setup check.
  Call DetectWarp
  ${If} $WarpFound == "1"
    DetailPrint "Cloudflare WARP is already installed."
  ${Else}
    ${IfNot} ${Silent}
      !insertmacro WingetInstall "Cloudflare.Warp" "Cloudflare WARP"
      Call DetectWarp
    ${EndIf}
    ${If} $WarpFound == "0"
      DetailPrint "Cloudflare WARP is still missing. Install it from cloudflare.com/warp before using the WARP route."
    ${EndIf}
  ${EndIf}
SectionEnd

Section "Desktop shortcut" SecDesktop
  CreateShortCut "$DESKTOP\OpenDeath.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
SectionEnd

Section "Start menu shortcut" SecStartMenu
  CreateDirectory "$SMPROGRAMS\OpenDeath"
  CreateShortCut "$SMPROGRAMS\OpenDeath\OpenDeath.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$SMPROGRAMS\OpenDeath\Uninstall OpenDeath.lnk" "$INSTDIR\Uninstall OpenDeath.exe"
SectionEnd

; The terminal CLI is the OpenCode engine that already ships inside the app, exposed as `opendeath`. It goes in a
; private bin folder that is added to the user PATH, so nothing is copied a second time and an update replaces it
; together with the app.
Section "Command line (opendeath)" SecCli
  CreateDirectory "$INSTDIR\bin"
  FileOpen $0 "$INSTDIR\bin\opendeath.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 '"$INSTDIR\resources\opencode-cli.exe" %*$\r$\n'
  FileClose $0

  ; Only append to PATH once; an upgrade must not add the same folder again. The marker also tells the uninstaller
  ; that this installer owns that entry.
  ReadRegStr $0 HKCU "Software\OpenDeath" "Cli"
  ${If} $0 != "1"
    ReadRegStr $1 HKCU "Environment" "Path"
    ${If} $1 == ""
      WriteRegExpandStr HKCU "Environment" "Path" "$INSTDIR\bin"
    ${Else}
      WriteRegExpandStr HKCU "Environment" "Path" "$1;$INSTDIR\bin"
    ${EndIf}
    WriteRegStr HKCU "Software\OpenDeath" "Cli" "1"
  ${EndIf}
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
SectionEnd

Section /o "Windscribe" SecWindscribe
  !insertmacro WingetInstall "Windscribe.Windscribe" "Windscribe"
SectionEnd

Section /o "Mullvad VPN" SecMullvad
  !insertmacro WingetInstall "MullvadVPN.MullvadVPN" "Mullvad VPN"
SectionEnd

Section /o "WireGuard" SecWireguard
  !insertmacro WingetInstall "WireGuard.WireGuard" "WireGuard"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "The OpenDeath desktop application, bundled OpenCode engine and uninstaller. Required."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Create an OpenDeath shortcut on the desktop. It launches opendeath.exe, not OpenCode."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Create OpenDeath and uninstall shortcuts in the Start menu."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCli} "Install the opendeath terminal CLI and add it to your user PATH. It runs the same engine that ships with the app."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecWarp} "Required. Install Cloudflare WARP from the official Cloudflare package. WARP is the default route and is put in place first."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecWindscribe} "Install Windscribe from the official Windscribe package. Used by the Windscribe route."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMullvad} "Install Mullvad VPN from the official Mullvad package. Used by the Mullvad route."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecWireguard} "Install WireGuard from the official WireGuard package. Used by WireGuard tunnels."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  SetShellVarContext current

  nsExec::ExecToLog 'taskkill /F /IM ${APP_EXE} /T'
  Pop $0

  Delete "$DESKTOP\OpenDeath.lnk"
  Delete "$SMPROGRAMS\OpenDeath\OpenDeath.lnk"
  Delete "$SMPROGRAMS\OpenDeath\Uninstall OpenDeath.lnk"
  RMDir "$SMPROGRAMS\OpenDeath"

  ; Remove only the PATH entry this installer added. PowerShell is present on every supported Windows version and
  ; splits the user PATH correctly even when it contains quotes or semicolon-heavy variables.
  ReadRegStr $0 HKCU "Software\OpenDeath" "Cli"
  ${If} $0 == "1"
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$$p=[Environment]::GetEnvironmentVariable(''Path'',''User''); if ($$p) { $$p=(($$p -split '';'') | Where-Object { $$_ -ne ''$INSTDIR\bin'' }) -join '';''; [Environment]::SetEnvironmentVariable(''Path'',$$p,''User'') }"'
    SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenDeath"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\opendeath.exe"
  DeleteRegKey HKCU "Software\OpenDeath"

  RMDir /r "$INSTDIR"
SectionEnd
