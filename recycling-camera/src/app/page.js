"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

export default function Home() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Attach the stream to the video once it renders, and release the camera when the stream is replaced or the page unmounts
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  // Live Camera Function
  // Uses getUserMedia to access camera on phone/laptop
  // Stores as stream
  async function startCamera() {
    setError("");
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Live camera isn't available here. It requires HTTPS (or localhost). Try choosing a photo instead.");
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      setFile(null);
      setPreview(null);
      setStream(media);
    } catch {
      setError("Couldn't open the camera. Check camera permissions, or choose a photo instead.");
    }
  }

  // Stops the stream with live camera
  function stopCamera() {
    setStream(null);
  }

  function handleImage(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    stopCamera(); // Added the stop camera function here
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError("");
  }

  // Capture Image from Stream
  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return Promise.resolve(null);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  }

  async function identifyItem() {
    const image = stream ? await captureFrame() : file;
    if (!image) {
      if (stream) setError("The camera isn't ready yet. Try again in a moment.");
      return;
    } //Modified to include captured frame from stream

    setLoading(true);
    setResult(null);
    setError("");

    const formData = new FormData();
    formData.append("image", image, stream ? "camera-frame.jpg" : image.name); //Modified to include captured frame from stream

    try {
      const response = await fetch(`${API_URL}/api/identify`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("The image could not be analyzed.");
      setResult(await response.json());
    } catch (requestError) {
      setError(`${requestError.message} Make sure the Java backend is running.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>♻️ Recycling Scanner</h1>
        <p className="subtitle">Point your camera at an item to learn how to dispose of it.</p>

        {stream ? (
          <>
            <video ref={videoRef} className="preview live" autoPlay playsInline muted />
            <button className="secondary" onClick={stopCamera}>Stop camera</button>
          </>
        ) : (
          <>
            <button className="scan" onClick={startCamera}>📷 Start live camera</button>
            <label className="picker">
              <strong>Or take / choose a photo</strong>
              <input type="file" accept="image/*" capture="environment" onChange={handleImage} />
            </label>
          </>
        )}

        <canvas ref={canvasRef} hidden />

        {!stream && preview && <img className="preview" src={preview} alt="Item selected for scanning" />}

        {(stream || file) && (
          <button className="scan" onClick={identifyItem} disabled={loading}>
            {loading ? "Identifying…" : stream ? "Scan Item" : "Identify Item"}
          </button>
        )}

        {error && <p className="error">{error}</p>}

        {result && (
          <div className="result">
            <h2>{result.name}</h2>
            <p><strong>Category:</strong> {result.category}</p>
            <p><strong>Preparation:</strong> {result.instructions}</p>
            <p><small>Demo confidence: {Math.round(result.confidence * 100)}%</small></p>
          </div>
        )}
      </section>
    </main>
  );
}
