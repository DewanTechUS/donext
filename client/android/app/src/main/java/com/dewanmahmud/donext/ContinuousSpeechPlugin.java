package com.dewanmahmud.donext;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

/**
 * Dictation that keeps listening through pauses.
 *
 * Android's speech recogniser ends after a short silence. This plugin restarts it after each
 * phrase and joins the text, so people can pause mid-sentence. A session ends when the app calls
 * stop(), or after a stretch of silence (one recogniser timeout, about 5 seconds) once something
 * was heard.
 *
 * Events: "partial" { text } with everything heard so far, "error" { code }, "end" { text }.
 * Microphone permission is requested by the app beforehand.
 */
@CapacitorPlugin(name = "ContinuousSpeech")
public class ContinuousSpeechPlugin extends Plugin {

    /** Silent recogniser rounds (each about 5 s) after speech before the session ends. */
    private static final int MAX_SILENT_ROUNDS_AFTER_SPEECH = 1;
    /** Silent rounds before giving up when nothing was said at all. */
    private static final int MAX_SILENT_ROUNDS_BEFORE_SPEECH = 2;

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private String language = "en-US";
    private boolean active = false;
    private boolean stopping = false;
    private boolean heardAnything = false;
    private int silentRounds = 0;
    private String committed = "";
    private String partial = "";

    @PluginMethod
    public void available(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        language = call.getString("language", "en-US");
        main.post(() -> {
            try {
                teardown();
                committed = "";
                partial = "";
                heardAnything = false;
                silentRounds = 0;
                stopping = false;
                active = true;
                createRecognizer();
                listen();
                call.resolve();
            } catch (Exception ex) {
                active = false;
                call.reject(ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (active && recognizer != null) {
                stopping = true;
                try {
                    recognizer.stopListening(); // delivers the final words, then onResults ends the session
                } catch (Exception ignored) {}
                // If no final result arrives, end anyway.
                main.postDelayed(() -> {
                    if (active && stopping) finish();
                }, 1500);
            }
            call.resolve();
        });
    }

    private void createRecognizer() {
        recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        recognizer.setRecognitionListener(new Listener());
    }

    private void listen() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        intent.putExtra("android.speech.extra.DICTATION_MODE", true);
        // Ask for longer pauses before a phrase ends (some recognisers ignore this; the restarts cover it).
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L);
        recognizer.startListening(intent);
    }

    /** Listen again shortly (after a phrase or a silent round). */
    private void restartSoon(boolean recreate) {
        main.postDelayed(() -> {
            if (!active || stopping) return;
            try {
                if (recreate || recognizer == null) {
                    teardown();
                    createRecognizer();
                }
                listen();
            } catch (Exception ex) {
                emitError("unknown");
                finish();
            }
        }, recreate ? 400 : 150);
    }

    private String text() {
        String c = committed.trim();
        String p = partial.trim();
        if (c.isEmpty()) return p;
        if (p.isEmpty()) return c;
        return c + " " + p;
    }

    private void emitText(String event, String value) {
        JSObject ret = new JSObject();
        ret.put("text", value);
        notifyListeners(event, ret);
    }

    private void emitError(String code) {
        JSObject ret = new JSObject();
        ret.put("code", code);
        notifyListeners("error", ret);
    }

    private void finish() {
        if (!active) return;
        active = false;
        stopping = false;
        committed = text();
        partial = "";
        teardown();
        emitText("end", committed);
    }

    private void teardown() {
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    private static String errorCode(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "permission-denied";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
            case SpeechRecognizer.ERROR_SERVER:
                return "network";
            case SpeechRecognizer.ERROR_AUDIO:
                return "no-microphone";
            default:
                return "unknown";
        }
    }

    private class Listener implements RecognitionListener {

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onPartialResults(Bundle results) {
            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (matches != null && !matches.isEmpty() && !matches.get(0).trim().isEmpty()) {
                partial = matches.get(0);
                heardAnything = true;
                silentRounds = 0;
                emitText("partial", text());
            }
        }

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            String said = matches != null && !matches.isEmpty() ? matches.get(0).trim() : "";
            if (!said.isEmpty()) {
                partial = said;
                heardAnything = true;
                silentRounds = 0;
            }
            committed = text();
            partial = "";
            emitText("partial", committed);
            if (stopping) {
                finish();
                return;
            }
            restartSoon(false); // keep listening through the pause
        }

        @Override
        public void onError(int error) {
            if (!active) return;
            if (stopping) {
                finish();
                return;
            }
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                // A stretch of silence: keep what was heard so far.
                committed = text();
                partial = "";
                silentRounds++;
                if (heardAnything && silentRounds >= MAX_SILENT_ROUNDS_AFTER_SPEECH) {
                    finish();
                } else if (!heardAnything && silentRounds >= MAX_SILENT_ROUNDS_BEFORE_SPEECH) {
                    emitError("no-speech");
                    finish();
                } else {
                    restartSoon(false);
                }
                return;
            }
            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) {
                restartSoon(true); // start over with a fresh recogniser
                return;
            }
            emitError(errorCode(error));
            finish();
        }
    }
}
