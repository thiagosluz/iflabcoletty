; IFG Lab Manager Agent - Windows Installer (Inno Setup)
; Build with: iscc /DVersion=1.0.0 agent/installer/iflab-agent.iss (from repo root)
; Requires: PyInstaller output in agent/dist/iflab-agent/ and nssm.exe in agent/installer/nssm/

#ifndef Version
#define Version "0.0.0"
#endif

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName=IFG Lab Manager Agent
AppVersion={#Version}
AppPublisher=IFG Lab Manager
AppPublisherURL=https://github.com/iflab/iflabcoletty
AppSupportURL=https://github.com/iflab/iflabcoletty
AppUpdatesURL=https://github.com/iflab/iflabcoletty/releases
DefaultDirName={autopf}\IFG Lab Manager Agent
DefaultGroupName=IFG Lab Manager Agent
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=iflab-agent-setup-{#Version}
SetupIconFile=
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
WizardStyle=modern
CloseApplications=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; PyInstaller one-folder output (run from agent/installer/, so .. = agent/)
Source: "..\dist\iflab-agent\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs
; NSSM (downloaded in GitHub Action to agent/installer/nssm/nssm.exe)
Source: "nssm\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\logs"; Permissions: users-full

[Code]
var
  ConfigPage: TInputQueryWizardPage;
  ApiUrl, LabId, AgentEmail, AgentPassword: String;
  ResultCode: Integer;

procedure InitializeWizard;
begin
  ConfigPage := CreateInputQueryPage(wpSelectDir,
    'Configuração do agente',
    'Informe os dados de conexão com o servidor IFG Lab Manager.',
    'Os valores serão gravados no ficheiro .env na pasta de instalação.');
  ConfigPage.Add('API Base URL (ex: http://servidor:8000/api/v1):', False);
  ConfigPage.Add('ID do Laboratório:', False);
  ConfigPage.Add('E-mail do agente:', False);
  ConfigPage.Add('Senha do agente:', True);
  ConfigPage.Values[0] := 'http://localhost:8000/api/v1';
  ConfigPage.Values[1] := '1';
  ConfigPage.Values[2] := '';
  ConfigPage.Values[3] := '';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = ConfigPage.ID then
  begin
    ApiUrl := ConfigPage.Values[0];
    LabId := ConfigPage.Values[1];
    AgentEmail := ConfigPage.Values[2];
    AgentPassword := ConfigPage.Values[3];
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvPath: String;
  EnvContent: AnsiString;
begin
  if CurStep = ssPostInstall then
  begin
    EnvPath := ExpandConstant('{app}') + '\.env';
    EnvContent := 'API_BASE_URL=' + ApiUrl + #13#10 +
      'LAB_ID=' + LabId + #13#10 +
      'AGENT_EMAIL=' + AgentEmail + #13#10 +
      'AGENT_PASSWORD=' + AgentPassword + #13#10 +
      'POLL_INTERVAL=30' + #13#10 +
      'LOG_LEVEL=INFO' + #13#10;
    SaveStringToFile(EnvPath, EnvContent, False);

    Exec(ExpandConstant('{app}\nssm.exe'), 'install IFLabAgent "' + ExpandConstant('{app}\iflab-agent.exe') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'set IFLabAgent DisplayName "IFG Lab Manager Agent"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'set IFLabAgent Description "IFG Lab Manager Agent - Monitors computer status and reports to server"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'set IFLabAgent Start SERVICE_AUTO_START', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'set IFLabAgent AppDirectory "' + ExpandConstant('{app}') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'start IFLabAgent', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec(ExpandConstant('{app}\nssm.exe'), 'stop IFLabAgent', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{app}\nssm.exe'), 'remove IFLabAgent confirm', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
