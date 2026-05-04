@echo off
cd /d "%~dp0"
title Minefield Signal - Launcher

echo ==========================================
echo    MINEFIELD: SIGNAL - LAUNCHER
echo ==========================================
echo.

:: 1. Verifica se esta na pasta certa
if not exist "package.json" (
    echo [ERRO] package.json nao encontrado!
    echo Certifique-se de que este script esta na raiz do projeto.
    goto erro
)

:: 2. Verifica se o Node.js (npm) esta instalado
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO CRITICO] O Node.js (npm) nao foi encontrado!
    echo Link oficial: https://nodejs.org/
    goto erro
)

:: 3. Garante a entrada padrão do Vite sem renomear o arquivo original
if exist "CAMPOMINADO.html" (
    if not exist "index.html" (
        echo [AVISO] Criando index.html como copia de CAMPOMINADO.html...
        copy "CAMPOMINADO.html" "index.html" >nul
    )
)

echo Escolha uma opcao de execucao:
echo [1] Modo DEV (Rapido, recarrega sozinho quando voce salva o codigo)
echo [2] Modo PROD (Compila e otimiza a versao final de Deploy)
echo.
set /p opcao="Digite 1 ou 2 e aperte ENTER: "

echo.
echo Instalando dependencias (se necessario)...
call npm install
if %errorlevel% neq 0 goto erro

if "%opcao%"=="1" (
    echo.
    echo Iniciando o Servidor de Desenvolvimento...
    call npm run dev -- --open
    if %errorlevel% neq 0 goto erro
) else if "%opcao%"=="2" (
    echo.
    echo Compilando a versao final do projeto...
    call npm run build
    if %errorlevel% neq 0 goto erro
    
    echo Iniciando o Servidor de Producao...
    call npm run preview -- --open
    if %errorlevel% neq 0 goto erro
) else (
    echo Opcao invalida. Fechando...
    pause
    exit /b
)

exit /b

:erro
echo.
echo ==========================================
echo [FALHA] Ocorreu um erro durante a execucao.
echo Leia a mensagem acima para descobrir o problema.
echo ==========================================
pause
