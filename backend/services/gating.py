class GatingEngine:
    def __init__(self):
        self.eligibility_threshold = {
            "centered": 0.50,
            "scale": 0.40,
            "brightness": 0.20,
            "contrast": 0.18,
            "stability": 0.48,
        }
        self.acceptance_threshold = 0.56

    def evaluate(self, quality, pose_bin_key):
        failures = []
        quality_failures = []
        is_up_pitch = pose_bin_key.endswith('_up')
        is_side_yaw = pose_bin_key.startswith('left_') or pose_bin_key.startswith('right_')

        centered_threshold = self.eligibility_threshold["centered"]
        if is_side_yaw and is_up_pitch:
            centered_threshold = 0.33
        elif is_side_yaw:
            centered_threshold = 0.40
        elif is_up_pitch:
            centered_threshold = 0.42

        stability_threshold = self.eligibility_threshold["stability"]
        if is_side_yaw and is_up_pitch:
            stability_threshold = 0.30
        elif is_side_yaw or is_up_pitch:
            stability_threshold = 0.36

        scale_threshold = self.eligibility_threshold["scale"]
        if is_side_yaw and is_up_pitch:
            scale_threshold = 0.30
        elif is_side_yaw or is_up_pitch:
            scale_threshold = 0.34

        brightness_threshold = self.eligibility_threshold["brightness"]
        contrast_threshold = self.eligibility_threshold["contrast"]
        if is_side_yaw and is_up_pitch:
            brightness_threshold = 0.17
            contrast_threshold = 0.14
        elif is_side_yaw or is_up_pitch:
            brightness_threshold = 0.18
            contrast_threshold = 0.16

        acceptance_threshold = self.acceptance_threshold
        if is_side_yaw and is_up_pitch:
            acceptance_threshold = 0.44
        elif is_side_yaw or is_up_pitch:
            acceptance_threshold = 0.49

        blur_proxy_threshold = 0.18
        if is_side_yaw and is_up_pitch:
            blur_proxy_threshold = 0.10
        elif is_side_yaw or is_up_pitch:
            blur_proxy_threshold = 0.14

        if quality["face_present"] < 0.5:
            failures.append("Looking for face")
        
        if quality["face_centered"] < centered_threshold:
            failures.append("Center your face")
            
        if quality["face_scale"] < scale_threshold:
            failures.append("Move closer")

        if quality["brightness"] < brightness_threshold:
            failures.append("Increase lighting")

        if quality.get("contrast", 0) < contrast_threshold:
            failures.append("Increase face contrast")
            
        if quality["stability"] < stability_threshold:
            failures.append("Hold steady")

        eligibility_passed = len(failures) == 0

        if quality["blur_proxy"] < blur_proxy_threshold:
            quality_failures.append("Improve camera focus")

        if quality["overall"] < acceptance_threshold:
            quality_failures.append("Adjust pose and hold")

        quality_pass = len(quality_failures) == 0
        
        accepted = eligibility_passed and quality_pass

        if failures:
            decision_reason = failures[0]
        elif quality_failures:
            decision_reason = quality_failures[0]
        elif accepted:
            decision_reason = "accepted"
        else:
            decision_reason = "Quality too low"

        return {
            "eligibilityPassed": eligibility_passed,
            "accepted": accepted,
            "failures": failures,
            "qualityFailures": quality_failures,
            "decisionReason": decision_reason,
        }
