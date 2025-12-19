package models

type RuleGroup struct {
	Name  string `yaml:"name" json:"name"`
	Rules []Rule `yaml:"rules" json:"rules"`
}

type Rule struct {
	Alert       string            `yaml:"alert" json:"alert,omitempty"`
	Expr        string            `yaml:"expr" json:"expr"`
	For         string            `yaml:"for" json:"for,omitempty"`
	Labels      map[string]string `yaml:"labels" json:"labels,omitempty"`
	Annotations map[string]string `yaml:"annotations" json:"annotations,omitempty"`
	// Augmented fields
	// Augmented fields
	FilePath string `json:"file_path,omitempty" yaml:"-"`
	Category string `json:"category,omitempty" yaml:"-"`
}

type RuleFile struct {
	Groups []RuleGroup `yaml:"groups" json:"groups"`
}
