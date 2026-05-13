package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingElement;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DrawingTextInterpreterTest {

    private final DrawingTextInterpreter interpreter = new DrawingTextInterpreter();

    @Test
    void extractsColumnLabelDimensionAndMaterial() {
        DrawingElement element = interpreter.toElement(
            "TEXT",
            "Column P1 300x300 mm M25 Concrete",
            "Structural",
            "x=1, y=2, z=0"
        );

        assertThat(element.type()).isEqualTo("COLUMN");
        assertThat(element.label()).isEqualTo("P1");
        assertThat(element.dimensions()).isEqualTo("300x300 mm");
        assertThat(element.material()).isEqualTo("M25");
    }
}
