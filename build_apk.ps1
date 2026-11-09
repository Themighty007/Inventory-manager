$ErrorActionPreference = "Stop"

$jdkBin = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot\bin"
$sdk = "C:\Android\sdk"
$buildTools = "$sdk\build-tools\34.0.0"
$androidJar = "$sdk\platforms\android-34\android.jar"

$aapt2 = "$buildTools\aapt2.exe"
$d8 = "$buildTools\d8.bat"
$zipalign = "$buildTools\zipalign.exe"
$apksigner = "$buildTools\apksigner.bat"
$javac = "$jdkBin\javac.exe"
$jar = "$jdkBin\jar.exe"
$keytool = "$jdkBin\keytool.exe"

$workDir = "c:\Users\test\Desktop\Gowthum workspace\daily life\Inventory manager"
$buildDir = "$workDir\android-build"
$appRes = "$workDir\android-app\app\src\main\res"
$manifest = "$workDir\android-app\app\src\main\AndroidManifest.xml"
$javaSrc = "$workDir\android-app\app\src\main\java\com\aegis\inventory\MainActivity.java"

Write-Host "Creating build directories..."
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Path "$buildDir\gen" -Force | Out-Null
New-Item -ItemType Directory -Path "$buildDir\bin" -Force | Out-Null
New-Item -ItemType Directory -Path "$buildDir\dex" -Force | Out-Null
New-Item -ItemType Directory -Path "$buildDir\res_compiled" -Force | Out-Null

Write-Host "Generating debug keystore if needed..."
$keystore = "$buildDir\debug.keystore"
& $keytool -genkeypair -v -keystore $keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"

Write-Host "1. Compiling resources with aapt2..."
& $aapt2 compile --dir $appRes -o "$buildDir\compiled_res.zip"

Write-Host "2. Linking resources and generating R.java..."
& $aapt2 link -I $androidJar --manifest $manifest "$buildDir\compiled_res.zip" --java "$buildDir\gen" -o "$buildDir\linked.apk" --auto-add-overlay

Write-Host "3. Compiling Java classes with javac..."
$rJava = Get-ChildItem -Path "$buildDir\gen" -Filter "R.java" -Recurse | Select-Object -ExpandProperty FullName
& $javac -encoding UTF-8 -cp $androidJar -d "$buildDir\bin" $javaSrc $rJava

Write-Host "4. Converting classes to DEX with d8..."
$classFiles = Get-ChildItem -Path "$buildDir\bin" -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName
& $d8 --release --min-api 24 --output "$buildDir\dex" --lib $androidJar $classFiles

Write-Host "5. Packaging classes.dex into APK..."
Copy-Item "$buildDir\linked.apk" "$buildDir\unaligned.apk"
Set-Location "$buildDir\dex"
& $jar -uf "$buildDir\unaligned.apk" "classes.dex"
Set-Location $workDir

Write-Host "6. Aligning APK with zipalign..."
& $zipalign -p -f -v 4 "$buildDir\unaligned.apk" "$buildDir\aligned.apk"

Write-Host "7. Signing APK with apksigner..."
& $apksigner sign --ks $keystore --ks-pass "pass:android" --key-pass "pass:android" --out "$workDir\SmartElectronicsInventory.apk" "$buildDir\aligned.apk"

Write-Host "SUCCESS! Generated APK at: $workDir\SmartElectronicsInventory.apk"
Get-Item "$workDir\SmartElectronicsInventory.apk" | Select-Object Name, Length, LastWriteTime
