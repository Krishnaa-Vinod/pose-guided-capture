class CoverageTracker:
    def __init__(self):
        self.yaws = ['left', 'center', 'right']
        self.pitches = ['up', 'center', 'down']
        self.capture_order = [
            'center_center',
            'center_up',
            'left_up',
            'right_up',
            'left_center',
            'right_center',
            'center_down',
            'left_down',
            'right_down',
        ]
        self.bins = {
            f"{y}_{p}": {
                "filled": False,
                "bestQuality": 0,
                "image": None,
                "selectedPath": None,
                "savedAtMs": None,
            }
            for y in self.yaws
            for p in self.pitches
        }

    def get_bin_key(self, yaw, pitch):
        # Map yaw to bin
        if yaw <= -9: yaw_bin = 'left'
        elif yaw < 9: yaw_bin = 'center'
        else: yaw_bin = 'right'

        # Map pitch to bin
        if pitch <= -10: pitch_bin = 'down'
        elif pitch < 10: pitch_bin = 'center'
        else: pitch_bin = 'up'

        return f"{yaw_bin}_{pitch_bin}"

    def update(self, key, quality, image_b64=None):
        if key not in self.bins:
            return False, self.get_progress()

        bin_data = self.bins[key]
        should_update = not bin_data["filled"] or quality > bin_data["bestQuality"]
        
        if should_update:
            bin_data["filled"] = True
            bin_data["bestQuality"] = quality
            if image_b64 is not None:
                bin_data["image"] = image_b64
            
        return should_update, self.get_progress()

    def set_selected_metadata(self, key, selected_path=None, saved_at_ms=None):
        if key not in self.bins:
            return

        if selected_path is not None:
            self.bins[key]["selectedPath"] = selected_path

        if saved_at_ms is not None:
            self.bins[key]["savedAtMs"] = int(saved_at_ms)

    def get_progress(self):
        filled = sum(1 for b in self.bins.values() if b["filled"])
        return filled / len(self.bins)

    def get_missing_bins(self):
        missing = [k for k in self.capture_order if not self.bins[k]["filled"]]
        return missing

    def get_selected_captures(self):
        selected = []
        for key in self.capture_order:
            bin_data = self.bins[key]
            if not bin_data["filled"] or not bin_data["image"]:
                continue
            selected.append({
                "key": key,
                "bestQuality": bin_data["bestQuality"],
                "image": bin_data["image"],
                "selectedPath": bin_data.get("selectedPath"),
                "savedAtMs": bin_data.get("savedAtMs"),
            })
        return selected

    def reset(self):
        for b in self.bins.values():
            b["filled"] = False
            b["bestQuality"] = 0
            b["image"] = None
            b["selectedPath"] = None
            b["savedAtMs"] = None
