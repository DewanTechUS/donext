package com.dewanmahmud.donext;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // DoNext's own plugin: dictation that keeps listening through pauses.
        registerPlugin(ContinuousSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
