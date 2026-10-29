@echo off
REM Instala dependencias, baja las fotos de Wikimedia Commons y abre el sitio.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install || goto error
)
if not exist public\fotos (
  echo Bajando fotos de Wikimedia Commons...
  call npm run fotos || goto error
)
echo.
echo Abriendo el sitio. Para verlo en el celular, usa la direccion "Network" que aparece abajo.
call npm run dev -- --host --open
goto :eof
:error
echo.
echo Algo fallo. Copia el mensaje de arriba y pasamelo.
pause
