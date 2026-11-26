; Before 3.0 the app was Nebula Terminal. Its installer went by that name, so this one
; would install Shelduck next to it. Instead the old app is removed the way an update
; removes it: its settings and what it added to Windows stay, and Shelduck takes them
; over at its first start (former.rs, launcher.rs). Its shortcuts are replaced here.
!define FORMERNAME "Nebula Terminal"
!define FORMERUNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${FORMERNAME}"
!define TASKBARPIN "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${FORMERNAME}.lnk"
Var FormerFolder
Var FormerStartMenu
Var FormerDesktop

!macro NSIS_HOOK_PREINSTALL
  StrCpy $FormerStartMenu 0
  StrCpy $FormerDesktop 0
  ReadRegStr $FormerFolder SHCTX "${MANUKEY}\${FORMERNAME}" ""
  ${If} $FormerFolder != ""
  ${AndIf} ${FileExists} "$FormerFolder\uninstall.exe"
    ; Silent: it closes the old app without asking. /UPDATE: it keeps the user's things.
    ExecWait '"$FormerFolder\uninstall.exe" /S /UPDATE _?=$FormerFolder'
    Delete "$FormerFolder\uninstall.exe"
    RMDir "$FormerFolder"
    DeleteRegKey SHCTX "${MANUKEY}\${FORMERNAME}"
    DeleteRegKey SHCTX "${FORMERUNINSTKEY}"
    ${If} ${FileExists} "$SMPROGRAMS\${FORMERNAME}.lnk"
      StrCpy $FormerStartMenu 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\${FORMERNAME}.lnk"
      Delete "$SMPROGRAMS\${FORMERNAME}.lnk"
    ${EndIf}
    ${If} ${FileExists} "$DESKTOP\${FORMERNAME}.lnk"
      StrCpy $FormerDesktop 1
      Delete "$DESKTOP\${FORMERNAME}.lnk"
    ${EndIf}
  ${EndIf}
!macroend

; The app adds "Open in Shelduck" and its administrator entry to File Explorer,
; and the shelduck command to the user's PATH, itself (launcher.rs).
; Uninstalling removes them; an update, which runs the old uninstaller, keeps them.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --uninstall'
    ; In case the app couldn't run: the menu entries are the visible part.
    DeleteRegKey HKCU "Software\Classes\Directory\shell\Shelduck"
    DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Shelduck"
    DeleteRegKey HKCU "Software\Classes\Drive\shell\Shelduck"
    DeleteRegKey HKCU "Software\Classes\Directory\shell\ShelduckAdmin"
    DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\ShelduckAdmin"
    DeleteRegKey HKCU "Software\Classes\Drive\shell\ShelduckAdmin"
  ${EndIf}
!macroend

; Windows keeps the icons of shortcuts and pinned apps in a cache, so the taskbar can
; go on showing an old icon after an update. Tell the shell that icons changed, and
; have it rebuild the cache. The installer is 32-bit: Sysnative reaches the 64-bit
; System32 instead of SysWOW64.
!macro NSIS_HOOK_POSTINSTALL
  ; An update creates no shortcut, so the ones Nebula Terminal had are made again here.
  ${If} $FormerStartMenu = 1
  ${AndIfNot} ${FileExists} "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  ${EndIf}
  ${If} $FormerDesktop = 1
  ${AndIfNot} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}
  ; A pin on the taskbar can't be made again, but it can start the new app.
  ${If} $FormerFolder != ""
  ${AndIf} ${FileExists} "${TASKBARPIN}"
    !insertmacro SetShortcutTarget "${TASKBARPIN}" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "${TASKBARPIN}"
  ${EndIf}

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${If} ${FileExists} "$WINDIR\Sysnative\ie4uinit.exe"
    ExecWait '"$WINDIR\Sysnative\ie4uinit.exe" -show'
  ${ElseIf} ${FileExists} "$SYSDIR\ie4uinit.exe"
    ExecWait '"$SYSDIR\ie4uinit.exe" -show'
  ${EndIf}
!macroend
