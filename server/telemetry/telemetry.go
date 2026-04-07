package telemetry

import "sync"

type Vessel struct {
	Name      string  `json:"name"`
	Altitude  float64 `json:"altitude"`
	Velocity  float64 `json:"velocity"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Apoapsis  float64 `json:"apoapsis"`
	Periapsis float64 `json:"periapsis"`
	Fuel      float64 `json:"fuel"`
	Timestamp int64   `json:"timestamp"`

	// Orbital elements
	Inclination        float64 `json:"inclination"`
	Eccentricity       float64 `json:"eccentricity"`
	SemiMajorAxis      float64 `json:"semiMajorAxis"`
	LAN                float64 `json:"lan"`
	ArgumentOfPeriapsis float64 `json:"argumentOfPeriapsis"`
	TrueAnomaly        float64 `json:"trueAnomaly"`
	Period             float64 `json:"period"`
	BodyRadius         float64 `json:"bodyRadius"`
	BodyName           string  `json:"bodyName"`
	AtmosphereHeight   float64 `json:"atmosphereHeight"`

	// EDL data
	Pitch           float64 `json:"pitch"`
	VerticalSpeed   float64 `json:"verticalSpeed"`
	HorizontalSpeed float64 `json:"horizontalSpeed"`
	RadarAltitude   float64 `json:"radarAltitude"`
	Throttle        float64 `json:"throttle"`

	// System bodies (flattened arrays)
	BodyNames           []string  `json:"bodyNames"`
	BodyTrueAnomalies   []float64 `json:"bodyTrueAnomalies"`
	BodyArgsOfPeriapsis []float64 `json:"bodyArgsOfPeriapsis"`
	BodyLANs            []float64 `json:"bodyLANs"`
	BodyInclinations    []float64 `json:"bodyInclinations"`
	BodySemiMajorAxes   []float64 `json:"bodySemiMajorAxes"`
	BodyRadii           []float64 `json:"bodyRadii"`

	// Resource breakdown
	ResourcePartNames  []string  `json:"resourcePartNames"`
	ResourceTypes      []string  `json:"resourceTypes"`
	ResourceAmounts    []float64 `json:"resourceAmounts"`
	ResourceMaxAmounts []float64 `json:"resourceMaxAmounts"`
}

type State struct {
	mu      sync.RWMutex
	Vessels map[string]*Vessel
}

func NewState() *State {
	return &State{
		Vessels: make(map[string]*Vessel),
	}
}

func (s *State) UpdateVessel(clientID string, v *Vessel) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Vessels[clientID] = v
}

func (s *State) RemoveVessel(clientID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Vessels, clientID)
}

func (s *State) GetAllVessels() map[string]*Vessel {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]*Vessel)
	for k, v := range s.Vessels {
		result[k] = v
	}
	return result
}
