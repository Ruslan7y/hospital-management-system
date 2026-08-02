import os
# TensorFlow ve oneDNN mesajlarını gizle
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

from flask import Flask, render_template, Response
import cv2
import time
import numpy as np
import mediapipe as mp
from mediapipe.python.solutions import face_detection as mp_face_detection
from scipy.signal import detrend
from scipy.fft import rfft, rfftfreq

# --- Flask Uygulamasını Başlatma ---
app = Flask(__name__)

# --- MediaPipe Yüz Tespiti ---
face_detector = mp_face_detection.FaceDetection(
    model_selection=0, 
    min_detection_confidence=0.7
)

# --- Global Değişkenler ---
RECORD_SECONDS = 20
WEBCAM_ID = 0
MIN_BPM, MAX_BPM = 45.0, 180.0

camera = cv2.VideoCapture(WEBCAM_ID)
app_state = "waiting" 
start_time = 0
data_buffer = []
final_bpm = 0

@app.after_request
def add_header(response):
    """Tarayıcı önbelleğini (cache) devre dışı bırakır."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

def process_frames():
    global app_state, start_time, data_buffer, final_bpm

    while True:
        success, frame = camera.read()
        if not success:
            break
        
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detector.process(frame_rgb)
        bboxs = results.detections

        frame_copy = frame.copy()
        ih, iw, _ = frame.shape

        if app_state == "waiting":
            cv2.putText(frame_copy, "Olcumu Baslatmak icin Yuzunuzu Gosterin", (30, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            if bboxs:
                app_state = "measuring"
                start_time = time.time()
                data_buffer = []

        elif app_state == "measuring":
            elapsed_time = time.time() - start_time
            if elapsed_time >= RECORD_SECONDS:
                app_state = "finished"
                if len(data_buffer) > 50:
                    avg_fps = len(data_buffer) / RECORD_SECONDS
                    detrended = detrend(data_buffer)
                    yf = rfft(detrended)
                    xf = rfftfreq(len(detrended), 1 / avg_fps)
                    mask = (xf >= MIN_BPM / 60.0) & (xf <= MAX_BPM / 60.0)
                    if np.any(mask):
                        peak_freq = xf[mask][np.argmax(np.abs(yf[mask]))]
                        final_bpm = int(peak_freq * 60)
                    else: final_bpm = -1
                else: final_bpm = -1

            elif bboxs:
                detection = bboxs[0]
                bbox = detection.location_data.relative_bounding_box
                x, y, w, h = int(bbox.xmin * iw), int(bbox.ymin * ih), int(bbox.width * iw), int(bbox.height * ih)
                x, y = max(0, x), max(0, y)
                
                cv2.rectangle(frame_copy, (x, y), (x + w, y + h), (0, 255, 0), 2)
                
                # Alın ROI tespiti
                forehead_y = y + int(h * 0.1)
                forehead_h = int(h * 0.15)
                forehead_roi = frame[forehead_y:forehead_y+forehead_h, x+int(w*0.3):x+int(w*0.7)]
                
                if forehead_roi.size > 0:
                    data_buffer.append(np.mean(forehead_roi[:, :, 1])) 
                
                progress = int((elapsed_time / RECORD_SECONDS) * 100)
                cv2.putText(frame_copy, f"Olculuyor: %{progress}", (30, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(frame_copy, "Lutfen Sabit Durun", (30, 90), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                app_state = "waiting"

        elif app_state == "finished":
            msg = f"Kalp Atisi: {final_bpm} BPM" if final_bpm > 0 else "Olcum Basarisiz!"
            color = (0, 255, 0) if final_bpm > 0 else (0, 0, 255)
            cv2.putText(frame_copy, msg, (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
            cv2.putText(frame_copy, "Yeniden baslatmak icin sayfayi yenileyin", (30, 130), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        ret, buffer = cv2.imencode('.jpg', frame_copy)
        yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

@app.route('/')
def index(): 
    return render_template('index.html')

@app.route('/video_feed')
def video_feed(): 
    return Response(process_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)