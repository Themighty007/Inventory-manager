package com.aegis.inventory

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.*
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private val defaultHost = "http://10.0.2.2:8000" // Default for Android Emulator to Windows Host

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)

        // Request Camera Permission for barcode/QR scanning
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 101)
        }

        val prefs = getSharedPreferences("inventory_prefs", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", defaultHost) ?: defaultHost

        setupWebView(serverUrl)

        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(url: String) {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                swipeRefresh.isRefreshing = false
                showConfigDialog("Could not connect to $failingUrl. Ensure your Windows FastAPI backend is running on port 8000.")
            }
        }

        webView.loadUrl(url)
    }

    private fun showConfigDialog(message: String) {
        val prefs = getSharedPreferences("inventory_prefs", Context.MODE_PRIVATE)
        val currentUrl = prefs.getString("server_url", defaultHost) ?: defaultHost

        val input = EditText(this)
        input.setText(currentUrl)

        AlertDialog.Builder(this)
            .setTitle("Backend Server Address")
            .setMessage("$message\n\nEnter your Windows machine's IP address (e.g. http://192.168.1.45:8000 or http://10.0.2.2:8000 for emulator):")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val newUrl = input.text.toString().trim()
                prefs.edit().putString("server_url", newUrl).apply()
                webView.loadUrl(newUrl)
            }
            .setNegativeButton("Retry") { _, _ ->
                webView.reload()
            }
            .show()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
