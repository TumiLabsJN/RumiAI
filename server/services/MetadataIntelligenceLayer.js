/**
 * Metadata Intelligence Layer for Google Video Intelligence Results
 * Produces structured, timestamped summaries of all GVI features
 */

class MetadataIntelligenceLayer {
    /**
     * Process and enhance GVI results with comprehensive metadata
     */
    static processEnhancedMetadata(result) {
        const annotations = result.annotationResults && result.annotationResults[0] ? result.annotationResults[0] : {};
        
        return {
            labelsSummary: this.processLabelDetection(annotations),
            objectsSummary: this.processObjectTracking(annotations),
            personsSummary: this.processPersonDetection(annotations),
            shotsSummary: this.processShotChangeDetection(annotations),
            explicitSummary: this.processExplicitContent(annotations),
            speechSummary: this.processSpeechTranscription(annotations)
        };
    }

    /**
     * Process LABEL_DETECTION with enhanced metadata
     */
    static processLabelDetection(annotations) {
        const labelData = {
            dominantLabels: [],
            labelTimeline: [],
            labelCooccurrence: {},
            totalUniqueLabels: 0,
            confidenceDistribution: {
                high: 0,    // > 0.8
                medium: 0,  // 0.5 - 0.8
                low: 0      // < 0.5
            }
        };

        if (!annotations.segmentLabelAnnotations && !annotations.shotLabelAnnotations) {
            return labelData;
        }

        // Combine segment and shot labels
        const allLabels = [
            ...(annotations.segmentLabelAnnotations || []),
            ...(annotations.shotLabelAnnotations || [])
        ];

        // Track label frequency and confidence
        const labelFrequency = {};
        const labelTimestamps = {};
        const labelsByTimeWindow = {};

        allLabels.forEach(label => {
            const description = label.entity.description;
            
            // Frequency tracking
            if (!labelFrequency[description]) {
                labelFrequency[description] = {
                    count: 0,
                    totalConfidence: 0,
                    appearances: []
                };
            }

            // Process each segment
            (label.segments || []).forEach(segment => {
                const confidence = segment.confidence || 0;
                labelFrequency[description].count++;
                labelFrequency[description].totalConfidence += confidence;
                
                // Track confidence distribution
                if (confidence > 0.8) labelData.confidenceDistribution.high++;
                else if (confidence > 0.5) labelData.confidenceDistribution.medium++;
                else labelData.confidenceDistribution.low++;

                // Timeline tracking
                const startTime = this.parseTimeOffset(segment.segment.startTimeOffset);
                const endTime = this.parseTimeOffset(segment.segment.endTimeOffset);
                
                labelFrequency[description].appearances.push({
                    startTime,
                    endTime,
                    confidence
                });

                // Group by time window for co-occurrence
                const timeWindow = Math.floor(startTime / 5); // 5-second windows
                if (!labelsByTimeWindow[timeWindow]) {
                    labelsByTimeWindow[timeWindow] = new Set();
                }
                labelsByTimeWindow[timeWindow].add(description);
            });
        });

        // Calculate dominant labels
        labelData.dominantLabels = Object.entries(labelFrequency)
            .map(([label, data]) => ({
                label,
                frequency: data.count,
                avgConfidence: data.totalConfidence / data.count,
                firstAppearance: Math.min(...data.appearances.map(a => a.startTime)),
                lastAppearance: Math.max(...data.appearances.map(a => a.endTime))
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

        // Build label timeline
        labelData.labelTimeline = Object.entries(labelFrequency)
            .flatMap(([label, data]) => 
                data.appearances.map(appearance => ({
                    label,
                    startTime: appearance.startTime,
                    endTime: appearance.endTime,
                    confidence: appearance.confidence
                }))
            )
            .sort((a, b) => a.startTime - b.startTime);

        // Calculate label co-occurrence
        Object.values(labelsByTimeWindow).forEach(labelsInWindow => {
            const labelArray = Array.from(labelsInWindow);
            for (let i = 0; i < labelArray.length; i++) {
                for (let j = i + 1; j < labelArray.length; j++) {
                    const pair = [labelArray[i], labelArray[j]].sort().join(' + ');
                    labelData.labelCooccurrence[pair] = (labelData.labelCooccurrence[pair] || 0) + 1;
                }
            }
        });

        labelData.totalUniqueLabels = Object.keys(labelFrequency).length;

        return labelData;
    }

    /**
     * Process OBJECT_TRACKING with enhanced metadata
     */
    static processObjectTracking(annotations) {
        const objectData = {
            primaryObjects: [],
            objectTimeline: [],
            movementPatterns: {},
            totalUniqueObjects: 0,
            objectInteractions: []
        };

        if (!annotations.objectAnnotations) {
            return objectData;
        }

        const objectTracking = {};

        annotations.objectAnnotations.forEach(obj => {
            const description = obj.entity?.description || 'unknown';
            
            if (!objectTracking[description]) {
                objectTracking[description] = {
                    count: 0,
                    confidence: 0,
                    frames: [],
                    boundingBoxes: [],
                    firstAppearance: Infinity,
                    lastAppearance: -Infinity
                };
            }

            // Process frames
            (obj.frames || []).forEach(frame => {
                const timestamp = this.parseTimeOffset(frame.timeOffset);
                const bbox = frame.normalizedBoundingBox;
                
                objectTracking[description].frames.push({
                    timestamp,
                    bbox: {
                        left: bbox?.left || 0,
                        top: bbox?.top || 0,
                        right: bbox?.right || 0,
                        bottom: bbox?.bottom || 0
                    }
                });

                objectTracking[description].count++;
                objectTracking[description].confidence += obj.confidence || 0;
                objectTracking[description].firstAppearance = Math.min(
                    objectTracking[description].firstAppearance, 
                    timestamp
                );
                objectTracking[description].lastAppearance = Math.max(
                    objectTracking[description].lastAppearance, 
                    timestamp
                );
            });
        });

        // Calculate primary objects
        objectData.primaryObjects = Object.entries(objectTracking)
            .map(([object, data]) => {
                const movement = this.analyzeObjectMovement(data.frames);
                return {
                    object,
                    occurrences: data.count,
                    avgConfidence: data.confidence / data.count,
                    firstAppearance: data.firstAppearance,
                    lastAppearance: data.lastAppearance,
                    duration: data.lastAppearance - data.firstAppearance,
                    movementPattern: movement.pattern,
                    velocityEstimate: movement.velocity,
                    proximityEstimate: movement.proximity
                };
            })
            .sort((a, b) => b.occurrences - a.occurrences)
            .slice(0, 10);

        // Build object timeline
        Object.entries(objectTracking).forEach(([object, data]) => {
            data.frames.forEach(frame => {
                objectData.objectTimeline.push({
                    object,
                    timestamp: frame.timestamp,
                    bbox: frame.bbox,
                    frame: Math.floor(frame.timestamp * 30) // Assuming 30fps
                });
            });
        });

        objectData.objectTimeline.sort((a, b) => a.timestamp - b.timestamp);
        objectData.totalUniqueObjects = Object.keys(objectTracking).length;

        // Analyze movement patterns
        objectData.movementPatterns = this.categorizeMovementPatterns(objectData.primaryObjects);

        return objectData;
    }

    /**
     * Process PERSON_DETECTION with enhanced metadata
     */
    static processPersonDetection(annotations) {
        const personData = {
            totalPersonsDetected: 0,
            peoplePresent: false,
            personTimeline: [],
            proximityDistribution: {
                close: 0,
                mid: 0,
                far: 0
            },
            activityPatterns: [],
            crowdDensity: []
        };

        if (!annotations.personDetectionAnnotations) {
            return personData;
        }

        const personTracking = [];
        let framePersonCount = {};

        annotations.personDetectionAnnotations.forEach((person, personId) => {
            const personInfo = {
                personId,
                frames: [],
                firstAppearance: Infinity,
                lastAppearance: -Infinity,
                avgProximity: 'mid'
            };

            // Process tracks
            (person.tracks || []).forEach(track => {
                (track.timestampedObjects || []).forEach(obj => {
                    const timestamp = this.parseTimeOffset(obj.timeOffset);
                    const bbox = obj.normalizedBoundingBox;
                    
                    const proximity = this.estimateProximity(bbox);
                    personData.proximityDistribution[proximity]++;

                    personInfo.frames.push({
                        timestamp,
                        bbox,
                        proximity
                    });

                    personInfo.firstAppearance = Math.min(personInfo.firstAppearance, timestamp);
                    personInfo.lastAppearance = Math.max(personInfo.lastAppearance, timestamp);

                    // Count persons per frame
                    const frameNum = Math.floor(timestamp * 30);
                    framePersonCount[frameNum] = (framePersonCount[frameNum] || 0) + 1;
                });
            });

            if (personInfo.frames.length > 0) {
                personTracking.push(personInfo);
            }
        });

        personData.totalPersonsDetected = personTracking.length;
        personData.peoplePresent = personTracking.length > 0;

        // Build person timeline
        personTracking.forEach(person => {
            personData.personTimeline.push({
                personId: person.personId,
                firstAppearance: person.firstAppearance,
                lastAppearance: person.lastAppearance,
                duration: person.lastAppearance - person.firstAppearance,
                avgProximity: this.calculateAvgProximity(person.frames)
            });
        });

        // Calculate crowd density over time
        const densityWindows = this.calculateCrowdDensity(framePersonCount);
        personData.crowdDensity = densityWindows;

        return personData;
    }

    /**
     * Process SHOT_CHANGE_DETECTION with enhanced metadata
     */
    static processShotChangeDetection(annotations) {
        const shotData = {
            totalShots: 0,
            avgShotDuration: 0,
            sceneChangeTimeline: [],
            shotComposition: [],
            transitionPatterns: {
                quick: 0,    // < 2 seconds
                medium: 0,   // 2-5 seconds
                long: 0      // > 5 seconds
            }
        };

        if (!annotations.shotAnnotations) {
            return shotData;
        }

        const shots = annotations.shotAnnotations.map(shot => ({
            startTime: this.parseTimeOffset(shot.startTimeOffset),
            endTime: this.parseTimeOffset(shot.endTimeOffset)
        }));

        shotData.totalShots = shots.length;

        // Calculate shot durations and patterns
        let totalDuration = 0;
        shots.forEach((shot, index) => {
            const duration = shot.endTime - shot.startTime;
            totalDuration += duration;

            // Categorize shot duration
            if (duration < 2) shotData.transitionPatterns.quick++;
            else if (duration < 5) shotData.transitionPatterns.medium++;
            else shotData.transitionPatterns.long++;

            // Build scene change timeline
            shotData.sceneChangeTimeline.push({
                shotNumber: index + 1,
                startTime: shot.startTime,
                endTime: shot.endTime,
                duration: duration,
                startFrame: Math.floor(shot.startTime * 30),
                endFrame: Math.floor(shot.endTime * 30)
            });
        });

        shotData.avgShotDuration = shots.length > 0 ? totalDuration / shots.length : 0;

        // Analyze shot composition with labels and objects
        shotData.shotComposition = this.analyzeShotComposition(
            shotData.sceneChangeTimeline,
            annotations
        );

        return shotData;
    }

    /**
     * Process EXPLICIT_CONTENT_DETECTION with enhanced metadata
     */
    static processExplicitContent(annotations) {
        const explicitData = {
            hasExplicitContent: false,
            explicitTimeline: [],
            explicitIntensityMap: {
                low: 0,
                medium: 0,
                high: 0
            },
            totalFlaggedFrames: 0,
            explicitDuration: 0
        };

        if (!annotations.explicitAnnotation || !annotations.explicitAnnotation.frames) {
            return explicitData;
        }

        const frames = annotations.explicitAnnotation.frames;
        explicitData.totalFlaggedFrames = frames.length;
        explicitData.hasExplicitContent = frames.length > 0;

        // Process each flagged frame
        frames.forEach(frame => {
            const timestamp = this.parseTimeOffset(frame.timeOffset);
            const likelihood = frame.pornographyLikelihood || 'UNKNOWN';
            
            // Map likelihood to intensity
            let intensity = 'low';
            if (likelihood === 'VERY_LIKELY' || likelihood === 'LIKELY') {
                intensity = 'high';
                explicitData.explicitIntensityMap.high++;
            } else if (likelihood === 'POSSIBLE') {
                intensity = 'medium';
                explicitData.explicitIntensityMap.medium++;
            } else {
                explicitData.explicitIntensityMap.low++;
            }

            explicitData.explicitTimeline.push({
                timestamp,
                frame: Math.floor(timestamp * 30),
                likelihood,
                intensity
            });
        });

        // Calculate total duration of explicit content
        if (explicitData.explicitTimeline.length > 0) {
            explicitData.explicitDuration = explicitData.explicitTimeline.length / 30; // Assuming 30fps
        }

        return explicitData;
    }

    /**
     * Process SPEECH_TRANSCRIPTION with enhanced metadata
     */
    static processSpeechTranscription(annotations) {
        const speechData = {
            hasHook: false,
            hookPhrases: [],
            ctaPhrases: [],
            tone: 'neutral',
            speechTimeline: [],
            wordFrequency: {},
            totalWords: 0,
            avgWordsPerSecond: 0,
            keyTopics: []
        };

        if (!annotations.speechTranscriptions || annotations.speechTranscriptions.length === 0) {
            return speechData;
        }

        // Hook patterns to detect
        const hookPatterns = [
            'wait for it', 'watch this', 'you won\'t believe', 'check this out',
            'wait till the end', 'wait til the end', 'watch until', 'stay tuned',
            'here\'s what happened', 'this is crazy', 'omg', 'no way'
        ];

        // CTA patterns to detect
        const ctaPatterns = [
            'follow', 'like', 'comment', 'share', 'subscribe', 'tap',
            'click', 'swipe', 'hit the', 'don\'t forget to', 'make sure to',
            'check out', 'link in bio', 'dm me', 'tag'
        ];

        // Tone indicators
        const toneIndicators = {
            excited: ['amazing', 'awesome', 'incredible', 'wow', 'omg', '!'],
            serious: ['important', 'serious', 'critical', 'must', 'need'],
            funny: ['lol', 'haha', 'funny', 'hilarious', 'joke'],
            educational: ['learn', 'how to', 'tutorial', 'tip', 'trick']
        };

        let fullTranscript = '';
        let totalDuration = 0;

        // Process each transcription
        annotations.speechTranscriptions.forEach(transcription => {
            if (transcription.alternatives && transcription.alternatives[0]) {
                const alternative = transcription.alternatives[0];
                const transcript = alternative.transcript || '';
                const words = alternative.words || [];
                
                fullTranscript += ' ' + transcript;

                // Process word-level data
                words.forEach(word => {
                    const startTime = this.parseTimeOffset(word.startTime);
                    const endTime = this.parseTimeOffset(word.endTime);
                    const wordText = word.word.toLowerCase();

                    // Build speech timeline
                    speechData.speechTimeline.push({
                        word: word.word,
                        startTime,
                        endTime,
                        confidence: word.confidence || 1.0
                    });

                    // Word frequency
                    speechData.wordFrequency[wordText] = (speechData.wordFrequency[wordText] || 0) + 1;
                    speechData.totalWords++;

                    // Update duration
                    totalDuration = Math.max(totalDuration, endTime);
                });
            }
        });

        // Detect hooks
        const lowerTranscript = fullTranscript.toLowerCase();
        hookPatterns.forEach(pattern => {
            if (lowerTranscript.includes(pattern)) {
                speechData.hasHook = true;
                speechData.hookPhrases.push(pattern);
            }
        });

        // Detect CTAs
        ctaPatterns.forEach(pattern => {
            if (lowerTranscript.includes(pattern)) {
                speechData.ctaPhrases.push(pattern);
            }
        });

        // Analyze tone
        let toneScores = { neutral: 0, excited: 0, serious: 0, funny: 0, educational: 0 };
        Object.entries(toneIndicators).forEach(([tone, indicators]) => {
            indicators.forEach(indicator => {
                if (lowerTranscript.includes(indicator)) {
                    toneScores[tone]++;
                }
            });
        });

        // Set dominant tone
        const maxToneScore = Math.max(...Object.values(toneScores));
        if (maxToneScore > 0) {
            speechData.tone = Object.entries(toneScores)
                .find(([tone, score]) => score === maxToneScore)[0];
        }

        // Calculate speech rate
        if (totalDuration > 0) {
            speechData.avgWordsPerSecond = speechData.totalWords / totalDuration;
        }

        // Extract key topics (most frequent content words)
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
        speechData.keyTopics = Object.entries(speechData.wordFrequency)
            .filter(([word]) => word.length > 3 && !stopWords.has(word))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));

        return speechData;
    }

    // Utility methods

    static parseTimeOffset(timeOffset) {
        if (!timeOffset) return 0;
        const seconds = parseInt(timeOffset.seconds || 0);
        const nanos = parseInt(timeOffset.nanos || 0);
        return seconds + (nanos / 1e9);
    }

    static analyzeObjectMovement(frames) {
        if (frames.length < 2) {
            return { pattern: 'stationary', velocity: 'none', proximity: 'mid' };
        }

        let totalMovement = 0;
        let xDirection = 0;
        let yDirection = 0;
        let avgSize = 0;

        for (let i = 1; i < frames.length; i++) {
            const prev = frames[i - 1];
            const curr = frames[i];
            
            const centerPrevX = (prev.bbox.left + prev.bbox.right) / 2;
            const centerPrevY = (prev.bbox.top + prev.bbox.bottom) / 2;
            const centerCurrX = (curr.bbox.left + curr.bbox.right) / 2;
            const centerCurrY = (curr.bbox.top + curr.bbox.bottom) / 2;

            const deltaX = centerCurrX - centerPrevX;
            const deltaY = centerCurrY - centerPrevY;
            const timeDelta = curr.timestamp - prev.timestamp;

            totalMovement += Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            xDirection += deltaX;
            yDirection += deltaY;

            const size = (curr.bbox.right - curr.bbox.left) * (curr.bbox.bottom - curr.bbox.top);
            avgSize += size;
        }

        avgSize /= frames.length;
        const avgMovement = totalMovement / (frames.length - 1);

        // Determine movement pattern
        let pattern = 'stationary';
        if (avgMovement > 0.1) {
            if (Math.abs(xDirection) > Math.abs(yDirection)) {
                pattern = xDirection > 0 ? 'movingRight' : 'movingLeft';
            } else {
                pattern = yDirection > 0 ? 'movingDown' : 'movingUp';
            }
        }

        // Determine velocity
        let velocity = 'slow';
        if (avgMovement > 0.3) velocity = 'fast';
        else if (avgMovement > 0.15) velocity = 'moderate';

        // Determine proximity based on bounding box size
        let proximity = 'mid';
        if (avgSize > 0.5) proximity = 'close';
        else if (avgSize < 0.1) proximity = 'far';

        return { pattern, velocity, proximity };
    }

    static estimateProximity(bbox) {
        if (!bbox) return 'mid';
        
        const width = (bbox.right || 0) - (bbox.left || 0);
        const height = (bbox.bottom || 0) - (bbox.top || 0);
        const area = width * height;

        if (area > 0.3) return 'close';
        if (area < 0.05) return 'far';
        return 'mid';
    }

    static calculateAvgProximity(frames) {
        const proximities = frames.map(f => f.proximity);
        const counts = { close: 0, mid: 0, far: 0 };
        
        proximities.forEach(p => counts[p]++);
        
        // Return most frequent proximity
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    static calculateCrowdDensity(framePersonCount) {
        const windows = [];
        const windowSize = 30; // 1 second at 30fps
        
        const frameNumbers = Object.keys(framePersonCount)
            .map(f => parseInt(f))
            .sort((a, b) => a - b);

        if (frameNumbers.length === 0) return windows;

        for (let i = 0; i < frameNumbers[frameNumbers.length - 1]; i += windowSize) {
            let maxInWindow = 0;
            for (let j = i; j < i + windowSize; j++) {
                maxInWindow = Math.max(maxInWindow, framePersonCount[j] || 0);
            }
            
            windows.push({
                startFrame: i,
                endFrame: i + windowSize - 1,
                timestamp: i / 30,
                personCount: maxInWindow,
                density: maxInWindow === 0 ? 'empty' : 
                        maxInWindow === 1 ? 'single' :
                        maxInWindow < 4 ? 'small_group' : 'crowd'
            });
        }

        return windows;
    }

    static analyzeShotComposition(shots, annotations) {
        const composition = [];

        shots.forEach(shot => {
            const shotInfo = {
                shotNumber: shot.shotNumber,
                dominantLabels: [],
                primaryObjects: [],
                personsPresent: false
            };

            // Find labels in this shot
            if (annotations.segmentLabelAnnotations) {
                annotations.segmentLabelAnnotations.forEach(label => {
                    label.segments.forEach(segment => {
                        const segStart = this.parseTimeOffset(segment.segment.startTimeOffset);
                        const segEnd = this.parseTimeOffset(segment.segment.endTimeOffset);
                        
                        if (segStart <= shot.endTime && segEnd >= shot.startTime) {
                            shotInfo.dominantLabels.push({
                                label: label.entity.description,
                                confidence: segment.confidence
                            });
                        }
                    });
                });
            }

            // Find objects in this shot
            if (annotations.objectAnnotations) {
                annotations.objectAnnotations.forEach(obj => {
                    const hasFrameInShot = (obj.frames || []).some(frame => {
                        const timestamp = this.parseTimeOffset(frame.timeOffset);
                        return timestamp >= shot.startTime && timestamp <= shot.endTime;
                    });
                    
                    if (hasFrameInShot) {
                        shotInfo.primaryObjects.push(obj.entity?.description || 'unknown');
                    }
                });
            }

            // Check for persons in this shot
            if (annotations.personDetectionAnnotations) {
                shotInfo.personsPresent = annotations.personDetectionAnnotations.some(person => {
                    return (person.tracks || []).some(track => {
                        return (track.timestampedObjects || []).some(obj => {
                            const timestamp = this.parseTimeOffset(obj.timeOffset);
                            return timestamp >= shot.startTime && timestamp <= shot.endTime;
                        });
                    });
                });
            }

            // Sort and limit dominant labels
            shotInfo.dominantLabels = shotInfo.dominantLabels
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 5)
                .map(l => l.label);

            // Deduplicate objects
            shotInfo.primaryObjects = [...new Set(shotInfo.primaryObjects)].slice(0, 5);

            composition.push(shotInfo);
        });

        return composition;
    }

    static categorizeMovementPatterns(objects) {
        const patterns = {
            stationary: [],
            movingLeft: [],
            movingRight: [],
            movingUp: [],
            movingDown: [],
            entering: [],
            exiting: []
        };

        objects.forEach(obj => {
            patterns[obj.movementPattern]?.push(obj.object);
            
            // Check for entering/exiting
            if (obj.firstAppearance > 0.5 && obj.lastAppearance < obj.duration - 0.5) {
                patterns.entering.push(obj.object);
            }
            if (obj.lastAppearance < obj.duration - 0.5) {
                patterns.exiting.push(obj.object);
            }
        });

        return patterns;
    }
}

module.exports = MetadataIntelligenceLayer;