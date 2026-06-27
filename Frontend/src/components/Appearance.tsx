import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCheck, faPalette } from "@fortawesome/free-solid-svg-icons";
import "./Appearance.css";
import { useSettings } from "../contexts/SettingsContext";
import {
  getSavedAppearanceTheme,
  saveAndApplyAppearanceTheme,
  THEME_PALETTES,
} from "../utils/theme";
import type { AppearanceTheme } from "../services/api";

const Appearance = () => {
  const navigate = useNavigate();
  const { updateLocalSettings } = useSettings();
  const [selectedTheme, setSelectedTheme] = useState<AppearanceTheme>(() =>
    getSavedAppearanceTheme(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedTheme(getSavedAppearanceTheme());
  }, []);

  const handleSelectTheme = (theme: AppearanceTheme) => {
    setSelectedTheme(theme);
    setSaving(true);
    saveAndApplyAppearanceTheme(theme);
    updateLocalSettings({ appearanceTheme: theme });

    window.setTimeout(() => setSaving(false), 350);
  };

  return (
    <div className="saved-screen appearance-screen">
      <div className="saved-header appearance-header">
        <button
          className="saved-back-btn"
          onClick={() => navigate("/")}
          aria-label="Back"
          type="button"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <span className="saved-header-title appearance-header-title">
          Appearance
        </span>
        {saving && <span className="appearance-saving">Saving...</span>}
      </div>

      <div className="saved-list appearance-content">
        <div className="appearance-intro">
          <FontAwesomeIcon icon={faPalette} />
          <span>Choose a palette. White and black follow the system.</span>
        </div>

        <div className="appearance-grid">
          {THEME_PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              className={`appearance-card ${
                selectedTheme === palette.id ? "active" : ""
              }`}
              onClick={() => handleSelectTheme(palette.id)}
            >
              <div
                className="appearance-preview"
                style={{ background: palette.preview.background }}
              >
                <span
                  className="appearance-bubble appearance-bubble--incoming"
                  style={{
                    background: palette.preview.inbound,
                    color: palette.preview.text,
                  }}
                >
                  Hey there!
                </span>
                <span
                  className="appearance-bubble appearance-bubble--outgoing"
                  style={{ background: palette.preview.outbound }}
                >
                  Cat 11/10
                </span>
              </div>

              <div className="appearance-card-body">
                <div className="appearance-card-title">
                  <span>{palette.name}</span>
                  {selectedTheme === palette.id && <FontAwesomeIcon icon={faCheck} />}
                </div>
                <div className="appearance-card-description">
                  {palette.description}
                </div>
                <div className="appearance-swatches">
                  {palette.colors.map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Appearance;
